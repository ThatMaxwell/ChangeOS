# >>> RESUME HERE (2026-10-18)
- **Sweet Vanilla 1.0 works in the cloud emulator**: ChangeOS launcher (Fog/Graphite/Loud, dock labels, auto columns), system accent (Material You follows ChangeOS), Termux/Aurora/Firefox, Play ban, quiet by default, and the **status chip** (battery % + ring) covering Android 17's Compose battery. Screenshots in media/sweet-vanilla/.
- Emulator-only gralloc bug (`mapper.ranchu` "!hasReadColorBufferDma") crashes anything that CPU-reads screen buffers (region sampling, task snapshots). CI works around it: 3-button nav, Launcher3 disabled, restricted-settings appop for the ring. Real phones don't have this driver, so the OS itself keeps Launcher3 (recents).
- DONE: ring trust is baked into the OS (ChangeOS release key + /system/etc/sysconfig/changeos-ecm.xml). Key backup: Documents/ChangeOS-key-backup and tools/keys (git-ignored); GitHub secrets CHANGEOS_KEYSTORE_B64 / _PASSWORD.
- DONE: v1.0.0 released (github.com/ThatMaxwell/ChangeOS/releases/tag/v1.0.0) via .github/workflows/release.yml on v* tags, notes in release-notes/; docs/changelog.html + nav link.
- NEXT (user's order): 3) Pumpkin Caramel (due Oct 31: pumpkin accent theme, icon pack, pumpkin-ring boot animation), 4) arm64 real-phone build.
- Emulator-only, CI keeps working around it: 3-button nav, Launcher3 disabled.
- Remaining crash: system_server task-snapshot abort mid-tour (same emulator bug).
- CYD: bridge `node esp32/bridge/cyd-bridge.js COM3`, quiz `node esp32/bridge/fun-questions.js 0.5 1.5` (has Skip). Answers in logs/cyd-answers.log.
- Site: smooth Lenis scroll, niri FAQ, version 1.0. Change Ring concept is a site section (docs/change-ring, embedded with ?embed; standalone at localhost:3000/change-ring/).

# Next up (picked by the user on the CYD, 2026-10-17)
- **Custom launcher**: the Fog home screen as a real ChangeOS launcher app (date card, monochrome icons, dock). Now built in apps/launcher (Sweet Vanilla).

# Real phone (user wants to flash it, buying a phone later)
- User's current phone can't be unlocked. Recommended: used Pixel 6a/7a/8a, factory unlocked (not Verizon).
- Needs: arm64 GSI + arm64 Firefox/Termux in CI, vbmeta with verification disabled, fastboot flashing guide.

# Codenames
- 1.0 **Sweet Vanilla** (current)
- 2.0 **Salted Caramel** (picked by the user on the CYD, 2026-10-17)
  - **Pumpkin Caramel**: the Halloween edition of 2.0, due by Oct 31. Not a separate OS: a Halloween theme (pumpkin/candy accents, dark "Graphite"-style base), a remade icon pack, and maybe a spooky boot animation variant. Build it as a theme + icon pack on top of Salted Caramel.
- 3.0 **Banana Split**: the BIG update (so packed it's splitting apart). Picked on the CYD. Avoid Android's names (ICS, Vanilla Ice Cream, Cinnamon Bun, etc.)
  - Ships when the user has a full free week.
- 4.0 to 6.0: more dessert names, TBD
- 7.0 **X**: the seventh release, the huge jump (7 is the user's favorite number). Far off.
  - X is the **stable, recommended release** (LTS-style): the one that never breaks, has enough features, and is the safe version to hop back to if something goes wrong.
  - Dessert versions are where new features land. After X, versions go back to dessert names, so X stays the only one of its kind.
  - "i run sweet vanilla!" / "i run salted caramel!" / "i run banana spli-" / "i run Change X."

# Website
- Add a changelog page (picked on the CYD). First entry: Sweet Vanilla 1.0.
- Framing: "the Linux philosophy, not a Linux distro" (real Linux on phones = postmarketOS).

# Ideas
- Feature ideas from the "versions bragging to X" skit (numbers are jokes, features are real):
  - **Customizable ring** (status icon / Change Ring LED styles)
  - **Native ChangeOS code editor**
  - **Low Battery mode** that strips the OS down even further
  - **Custom SystemUI** (3.0 Banana Split)
  - 7.0 X: *"i am perfect."*
- **Declarative phone config (Nix-style)**: one file (theme, accent, apps, settings) that the user edits and the OS applies. Inspired by NixOS.

# Status 2026-10-17
- The patched ChangeOS image is built (avd-image/) with debloat, Aurora, Firefox, bootanim and props. Rebuild steps: build/prep_image.sh, then patch_gsi.py, then make_avd_image.py (the scripts are in build/, and the WSL 1 distro is "ChangeOS-Ubuntu").
- **The local emulator can't run on this PC.** The emulator segfaults (139) at VM start under WHPX even with Google's stock Android 17 image and 1 core. The CPU is an i5-2400 (Sandy Bridge). Don't retry locally.
- Next: boot it in the cloud with Cuttlefish on a Google Cloud VM with nested virtualization, which needs the user's GCP account. Otherwise flash the arm64 GSI onto a real phone.

# Pick up here (paused 2026-10-16)

## Done
- GSI: Android 17 QPR3 beta (DP11.260918.006, API 37), aosp_x86_64. The SHA-256 is verified, and it's unpacked in `gsi/extracted/` as a raw ext4 `system.img`, a user build with release-keys.
- `Logo.svg`, the new ring mark. The raccoon is in `archive/`.
- `build/make_bootanim.py` renders `out/bootanimation.zip` (600x760 at 30 fps; ring intro, then dots loop, then the bullseye and wordmark). Run `python build/make_bootanim.py fog|graphite`.
- Downloads in `downloads/`: Aurora Store 4.8.4 (F-Droid), Firefox 158.0 x86_64 (Mozilla archive), and Temurin JDK 21 (checksum verified, unpacked to `tools/jdk21`).

## Not done
- **Emulator base image** `system-images;android-37.0;google_apis;x86_64` was stopped mid-download, before anything was extracted. Re-run:
  `JAVA_HOME=tools/jdk21 sdkmanager "system-images;android-37.0;google_apis;x86_64"`
- **ext4 write tool.** The emulator ships Cygwin's ext2fs DLLs but no `debugfs`. We need either Cygwin's e2fsprogs package (for `debugfs.exe`) or a WSL Ubuntu distro, and it needs the user's OK first.
- Patch `system.img` (into a copy): replace `/system/media/bootanimation.zip`, debloat the stock AOSP apps, add Aurora and Firefox, set the name props, and block `com.android.vending`.
- Create the ChangeOS AVD (base image dir with `system.img` swapped for ours), boot it, and take screenshots.
- Root for the terminal: the GSI is a user build, so `adb root` won't work. Next to try is patching the AVD ramdisk with Magisk, otherwise the terminal gets ADB-level power.

## Limits of GSI-only (to explain to the user)
- SystemUI can only be restyled through overlays (icons, colors, shapes), not rewritten. The combined status icon needs a SystemUI change, so the best we get is a close approximation.
- The Play Store ban is best-effort: we don't ship it, and we remove it if it ever appears. A hard block needs a framework change.
