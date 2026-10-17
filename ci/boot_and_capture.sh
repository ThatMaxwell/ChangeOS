#!/bin/bash
# Boot the ChangeOS AVD headless and capture media: boot frames (-> GIF/MP4), screenshots and a demo video.
# Expects: $ANDROID_HOME, an AVD called ChangeOS, and the patched image in $CHANGEOS_ROOT/avd-image.
set -uo pipefail
ROOT=${CHANGEOS_ROOT:?}
OUT="$ROOT/media"
mkdir -p "$OUT/boot" "$OUT/shots"
ADB="$ANDROID_HOME/platform-tools/adb"
EMU="$ANDROID_HOME/emulator/emulator"

log() { echo "[$(date +%H:%M:%S)] $*"; }
# screenshots go through the emulator console: reliable even when the guest's screencap breaks
shot() {
  local before; before=$(ls "$OUT/shots"/Screenshot_*.png 2>/dev/null | wc -l)
  emu "screenrecord screenshot $OUT/shots"; sleep 1
  local f; f=$(ls -t "$OUT/shots"/Screenshot_*.png 2>/dev/null | head -1)
  [ -n "$f" ] && [ "$(ls "$OUT/shots"/Screenshot_*.png | wc -l)" -gt "$before" ] && mv "$f" "$OUT/shots/$1.png" && log "shot $1"
}

# ChangeOS is a user build (ro.adb.secure=1): the emulator must hand Android our adb key to pre-authorize it
for d in "$HOME/.android" "${ANDROID_USER_HOME:-}"; do
  [ -n "$d" ] || continue
  mkdir -p "$d"
  [ -f "$d/adbkey" ] || "$ADB" keygen "$d/adbkey" >/dev/null 2>&1
done
[ -n "${ANDROID_USER_HOME:-}" ] && cp -f "$HOME/.android/adbkey"* "$ANDROID_USER_HOME/" 2>/dev/null
"$ADB" kill-server >/dev/null 2>&1; "$ADB" start-server >/dev/null 2>&1

# emulator console (telnet :5554) works without adb: an empty auth token disables its login
for d in "$HOME" "${ANDROID_USER_HOME:-}"; do [ -n "$d" ] && : > "$d/.emulator_console_auth_token"; done
emu() {  # send one console command
  exec 3<>/dev/tcp/127.0.0.1/5554 || return 1
  sleep 0.5; printf '%s\r\nquit\r\n' "$1" >&3; timeout 5 cat <&3 >/dev/null; exec 3>&-
}
mkdir -p "$OUT/console-shots"

log "starting emulator"
"$EMU" -avd ChangeOS -sysdir "$ROOT/avd-image" -no-window -no-audio -no-snapshot -wipe-data \
  -gpu swiftshader_indirect -camera-back none -camera-front none -feature -GLDMA,-GLDMA2 -logcat '*:W' -logcat-output "$OUT/logcat-boot.txt" \
  > "$OUT/emulator.txt" 2>&1 &
EMU_PID=$!

# record the virtual display from the console (independent of adb): 3 x 3-minute clips + a screenshot every 20 s
for _ in $(seq 1 60); do (exec 3<>/dev/tcp/127.0.0.1/5554) 2>/dev/null && break; sleep 1; done
log "console up, recording display"
(
  for part in 1 2 3; do
    emu "screenrecord start --time-limit 180 --size 720x1600 $OUT/screen-$part.webm"
    for _ in $(seq 1 9); do sleep 20; emu "screenrecord screenshot $OUT/console-shots"; done
    emu "screenrecord stop"; sleep 2
  done
) &
REC_LOOP=$!

# wait for adb, printing every state change (offline / unauthorized / device)
log "waiting for adb"
last=""; up=0
for _ in $(seq 1 150); do
  kill -0 $EMU_PID 2>/dev/null || { log "emulator exited"; break; }
  st=$("$ADB" devices | awk 'NR>1 && $2 {print $2; exit}')
  [ "$st" != "$last" ] && { log "adb state: ${st:-none}"; last=$st; }
  [ "$st" = "device" ] && { up=1; break; }
  sleep 4
done
console_media() {
  kill $REC_LOOP 2>/dev/null; emu "screenrecord stop"; sleep 3
  for f in "$OUT"/screen-*.webm; do
    [ -s "$f" ] || continue
    ffmpeg -loglevel error -y -i "$f" -c:v libx264 -pix_fmt yuv420p -vf "scale=540:-2" "${f%.webm}.mp4"
  done
  ls "$OUT"/screen-*.mp4 >/dev/null 2>&1 && {
    ls "$OUT"/screen-*.mp4 | sed "s#^#file '#; s#\$#'#" > "$OUT/list.txt"
    ffmpeg -loglevel error -y -f concat -safe 0 -i "$OUT/list.txt" -c copy "$OUT/console-full.mp4"
    ffmpeg -loglevel error -y -i "$OUT/console-full.mp4" -vf "fps=8,scale=270:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse" -t 60 "$OUT/console-boot.gif"
  }
  ls -la "$OUT" "$OUT/console-shots" | head -40
}

if [ $up = 0 ]; then
  log "adb never reached 'device'. what's crashing (logcat via virtconsole):"
  grep -ahE "FATAL EXCEPTION|Fatal signal|Process: |beginning of crash|AndroidRuntime|E/.*Exception" "$OUT/emulator.txt" "$OUT/logcat-boot.txt" | sort | uniq -c | sort -rn | head -40
  log "kernel/init tail:"
  grep -aE "Kernel panic|avb|fs_mgr|first_stage|adbd|bootanim|boot_completed" "$OUT/emulator.txt" | tail -30
  console_media
  exit 1
fi
"$ADB" logcat -v time > "$OUT/logcat.txt" 2>&1 &
log "adb up, capturing boot frames"
i=0; booted=0
for _ in $(seq 1 900); do
  if ! kill -0 $EMU_PID 2>/dev/null; then log "emulator exited"; break; fi
  i=$((i+1))  # boot frames come from the console recording; guest screencap crashes on GPU readback
  if [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then booted=1; break; fi
  sleep 0.4
done
log "boot_completed=$booted after $i frames"
"$ADB" shell getprop > "$OUT/getprop.txt" 2>/dev/null
[ $booted = 1 ] || { tail -80 "$OUT/emulator.txt"; exit 1; }

sleep 20  # let the launcher settle
"$ADB" shell settings put system screen_off_timeout 1800000
"$ADB" shell input keyevent 82   # wake + dismiss keyguard
"$ADB" shell wm dismiss-keyguard 2>/dev/null
sleep 2

# demo video while we walk around the OS
"$ADB" shell screenrecord --time-limit 120 --bit-rate 6000000 /sdcard/demo.mp4 &
REC=$!
sleep 1
HOME_CMP=os.changeos.launcher/.HomeActivity
look() { "$ADB" shell am start -n $HOME_CMP --es theme "$1" --es accent "$2" >/dev/null 2>&1; sleep 4; }
"$ADB" shell cmd package resolve-activity --brief -c android.intent.category.HOME -a android.intent.action.MAIN | tr -d '\r' | tail -1 > "$OUT/default-home.txt"
"$ADB" shell input keyevent 3; sleep 4; shot 01-home-fog
"$ADB" shell input swipe 360 1350 360 350 300; sleep 3; shot 02-app-drawer
"$ADB" shell input keyevent 3; sleep 2
"$ADB" shell input swipe 360 700 360 700 900; sleep 2; shot 03-theme-picker
"$ADB" shell input keyevent 4; sleep 1
look graphite 2F6BFF; shot 04-home-graphite
look loud FF2E88; shot 05-home-loud-pink
"$ADB" shell cmd statusbar expand-settings; sleep 4; shot 06-quick-settings-accent
"$ADB" shell cmd statusbar collapse; sleep 1
look fog 2F6BFF
"$ADB" shell am start -a android.settings.DEVICE_INFO_SETTINGS >/dev/null; sleep 4; shot 07-about-phone
"$ADB" shell input keyevent 3; sleep 1
"$ADB" shell monkey -p com.termux -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 10; shot 08-terminal
"$ADB" shell input keyevent 3; sleep 1
"$ADB" shell monkey -p com.aurora.store -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 8; shot 09-aurora-store
"$ADB" shell input keyevent 3; sleep 1
"$ADB" shell monkey -p org.mozilla.firefox -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 10; shot 10-firefox
"$ADB" shell input keyevent 3; sleep 3; shot 11-home-again
wait $REC
"$ADB" pull /sdcard/demo.mp4 "$OUT/demo.mp4" >/dev/null && log "pulled demo.mp4"

# proof sheet
{
  echo "== ChangeOS on GitHub Actions =="
  echo "display.id : $("$ADB" shell getprop ro.build.display.id | tr -d '\r')"
  echo "model      : $("$ADB" shell getprop ro.product.model | tr -d '\r')"
  echo "changeos   : $("$ADB" shell getprop ro.changeos.version | tr -d '\r')"
  echo "codename   : $("$ADB" shell getprop ro.changeos.codename | tr -d '\r')"
  echo "home app   : $(cat "$OUT/default-home.txt")"
  echo "accent cfg : $("$ADB" shell settings get secure theme_customization_overlay_packages | tr -d '\r')"
  echo "android    : $("$ADB" shell getprop ro.build.version.release | tr -d '\r') (API $("$ADB" shell getprop ro.build.version.sdk | tr -d '\r'))"
  echo; echo "== third-party / notable packages =="
  "$ADB" shell pm list packages | tr -d '\r' | grep -E "aurora|mozilla|termux|changeos|vending|launcher|browser|gallery|music|calendar|deskclock" | sort
  echo; echo "== Google Play present? =="
  "$ADB" shell pm list packages com.android.vending | tr -d '\r' | grep -q vending && echo "YES (unexpected)" || echo "no"
} > "$OUT/report.txt"
cat "$OUT/report.txt"

# boot frames -> GIF + MP4
if [ "$i" -gt 5 ]; then
  ffmpeg -loglevel error -y -framerate 4 -i "$OUT/boot/%04d.png" -vf "scale=360:-2:flags=lanczos,fps=8" -c:v libx264 -pix_fmt yuv420p "$OUT/boot.mp4"
  ffmpeg -loglevel error -y -framerate 4 -i "$OUT/boot/%04d.png" -vf "scale=300:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse" "$OUT/boot.gif"
fi
if [ -f "$OUT/demo.mp4" ]; then
  ffmpeg -loglevel error -y -i "$OUT/demo.mp4" -vf "fps=10,scale=320:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse" -t 45 "$OUT/demo.gif"
fi
console_media
ls -la "$OUT" "$OUT/shots"
kill $EMU_PID 2>/dev/null
exit 0
