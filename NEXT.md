# >>> RESUME HERE (2026-10-17, usage limit)
- Sweet Vanilla 0.1 builds and boots in GitHub Actions (workflow "Build and boot ChangeOS"). Verified on the running OS: display id "ChangeOS 0.1 Sweet Vanilla", ChangeOS launcher installed as a priv-app, Termux/Aurora/Firefox present, Google Play absent.
- Blocker: SurfaceFlinger crashes ("!hasReadColorBufferDma" assertion) under the swiftshader renderer, so the screen falls back to the boot animation and the launcher is never visible. GLDMA/GLDMA2 off didn't help.
- Run 39072808813 tests 3 GPU renderers in parallel (swangle_indirect, guest, swiftshader_indirect). Download artifacts changeos-media-<gpu>, check shots/ and report.txt (home app should be os.changeos.launcher/.HomeActivity, not FallbackHome). Keep the renderer that works.
- CYD: bridge + quiz run as `node esp32/bridge/cyd-bridge.js COM3` and `node esp32/bridge/fun-questions.js 0.5 1.5`. Answers in logs/cyd-answers.log.
- User picks from the CYD: launcher first, Stack clock + PIN lock screen, silent boot, monochrome icons, blue accent, JetBrains Mono, website changelog, 0.2 = Salted Caramel.

# Next up (picked by the user on the CYD, 2026-10-17)
- **Custom launcher**: the Fog home screen as a real ChangeOS launcher app (date card, monochrome icons, dock). Now built in apps/launcher (Sweet Vanilla).

# Real phone (user wants to flash it, buying a phone later)
- User's current phone can't be unlocked. Recommended: used Pixel 6a/7a/8a, factory unlocked (not Verizon).
- Needs: arm64 GSI + arm64 Firefox/Termux in CI, vbmeta with verification disabled, fastboot flashing guide.

# Codenames
- 0.1 **Sweet Vanilla** (current)
- 0.2 **Salted Caramel** (picked by the user on the CYD, 2026-10-17)
  - **Pumpkin Caramel**: the Halloween edition of 0.2, due by Oct 31. Not a separate OS: a Halloween theme (pumpkin/candy accents, dark "Graphite"-style base), a remade icon pack, and maybe a spooky boot animation variant. Build it as a theme + icon pack on top of Salted Caramel.
- 0.3 **Banana Split**: the BIG update (so packed it's splitting apart). Picked on the CYD. Avoid Android's names (ICS, Vanilla Ice Cream, Cinnamon Bun, etc.)

# Website
- Add a changelog page (picked on the CYD). First entry: Sweet Vanilla 0.1.
- Framing: "the Linux philosophy, not a Linux distro" (real Linux on phones = postmarketOS).

# Ideas
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
