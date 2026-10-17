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
