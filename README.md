# ChangeOS

A custom Android OS built on a prebuilt GSI (no AOSP source build). Logo: `Logo.svg`.

## Which GSI to download

| Goal | Pick |
|---|---|
| Test in the Android Studio emulator on this PC | **x86_64** GSI |
| Flash onto a real phone later | **arm64** GSI |

The emulator on an x86_64 Windows PC can't run an arm64 GSI at a usable speed. Grab the x86_64 one first.

## Plan (GSI only)

1. Put the downloaded GSI zip in `gsi/` and extract `system.img` (plus `vbmeta.img` if included).
2. Check the image: is it sparse or raw, and which Android version is it?
3. Create an AVD with a matching stock x86_64 system image of the **same Android version**.
4. Copy that AVD's image folder to `avd-image/` and replace `system.img` with the GSI's (converted to raw if it's sparse).
5. Boot with `emulator -avd ChangeOS -verbose -writable-system` and debug.
6. Brand it by modifying the GSI's `system.img`: boot animation from `Logo.png`, name, wallpaper and apps. Then repack.

Booting a GSI in an AVD isn't officially supported, so step 5 may take some fiddling.

## Sources

- https://source.android.com/docs/setup/create/gsi
- https://developer.android.com/codelabs/using-android-q-gsi
- https://source.android.com/docs/setup/test/avd
