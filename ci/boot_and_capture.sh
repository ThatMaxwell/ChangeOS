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
shot() { "$ADB" exec-out screencap -p > "$OUT/shots/$1.png" 2>/dev/null && log "shot $1"; }

# ChangeOS is a user build (ro.adb.secure=1): the emulator must hand Android our adb key to pre-authorize it
for d in "$HOME/.android" "${ANDROID_USER_HOME:-}"; do
  [ -n "$d" ] || continue
  mkdir -p "$d"
  [ -f "$d/adbkey" ] || "$ADB" keygen "$d/adbkey" >/dev/null 2>&1
done
[ -n "${ANDROID_USER_HOME:-}" ] && cp -f "$HOME/.android/adbkey"* "$ANDROID_USER_HOME/" 2>/dev/null
"$ADB" kill-server >/dev/null 2>&1; "$ADB" start-server >/dev/null 2>&1

log "starting emulator"
"$EMU" -avd ChangeOS -sysdir "$ROOT/avd-image" -no-window -no-audio -no-snapshot -wipe-data \
  -gpu swiftshader_indirect -camera-back none -camera-front none -show-kernel \
  > "$OUT/emulator.txt" 2>&1 &
EMU_PID=$!

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
if [ $up = 0 ]; then
  log "adb never reached 'device'. kernel/init tail:"
  grep -aE "init:|Kernel panic|avb|dm-verity|fs_mgr|first_stage|adbd|zygote|bootanim" "$OUT/emulator.txt" | tail -60
  tail -30 "$OUT/emulator.txt"
  exit 1
fi
"$ADB" logcat -v time > "$OUT/logcat.txt" 2>&1 &
log "adb up, capturing boot frames"
i=0; booted=0
for _ in $(seq 1 900); do
  if ! kill -0 $EMU_PID 2>/dev/null; then log "emulator exited"; break; fi
  "$ADB" exec-out screencap -p > "$OUT/boot/$(printf %04d $i).png" 2>/dev/null && [ -s "$OUT/boot/$(printf %04d $i).png" ] && i=$((i+1))
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
"$ADB" shell screenrecord --time-limit 60 --bit-rate 6000000 /sdcard/demo.mp4 &
REC=$!
sleep 1
"$ADB" shell input keyevent 3; sleep 3; shot 01-home
"$ADB" shell input swipe 540 2000 540 500 350; sleep 3; shot 02-app-drawer
"$ADB" shell input keyevent 3; sleep 2
"$ADB" shell cmd statusbar expand-settings; sleep 3; shot 03-quick-settings
"$ADB" shell cmd statusbar collapse; sleep 1
"$ADB" shell am start -a android.settings.DEVICE_INFO_SETTINGS >/dev/null; sleep 4; shot 04-about-phone
"$ADB" shell input keyevent 3; sleep 1
"$ADB" shell monkey -p com.aurora.store -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 8; shot 05-aurora-store
"$ADB" shell input keyevent 3; sleep 1
"$ADB" shell monkey -p org.mozilla.firefox -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 10; shot 06-firefox
"$ADB" shell input keyevent 3; sleep 2; shot 07-home-again
wait $REC
"$ADB" pull /sdcard/demo.mp4 "$OUT/demo.mp4" >/dev/null && log "pulled demo.mp4"

# proof sheet
{
  echo "== ChangeOS on GitHub Actions =="
  echo "display.id : $("$ADB" shell getprop ro.build.display.id | tr -d '\r')"
  echo "model      : $("$ADB" shell getprop ro.product.model | tr -d '\r')"
  echo "changeos   : $("$ADB" shell getprop ro.changeos.version | tr -d '\r')"
  echo "android    : $("$ADB" shell getprop ro.build.version.release | tr -d '\r') (API $("$ADB" shell getprop ro.build.version.sdk | tr -d '\r'))"
  echo; echo "== third-party / notable packages =="
  "$ADB" shell pm list packages | tr -d '\r' | grep -E "aurora|mozilla|vending|launcher|browser|gallery|music|calendar|deskclock" | sort
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
ls -la "$OUT" "$OUT/shots"
kill $EMU_PID 2>/dev/null
exit 0
