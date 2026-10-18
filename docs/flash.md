# Flashing ChangeOS on a phone (arm64)

> **Experimental.** The arm64 image is built automatically but hasn't been tested on real hardware yet. It's a GSI (Generic System Image), so some hardware (camera, fingerprint, calls, Bluetooth audio) may not work on some phones. Back up everything first.

## What you need

- An **arm64 phone that supports Project Treble**, running **Android 14 or newer** from the factory. Check with the *Treble Info* app: it should report arm64 and Treble support.
- An **unlockable bootloader**. Pixels are the easiest. Many carrier phones and some brands (for example a lot of Motorola carrier models) can't be unlocked, and then ChangeOS can't be installed.
- A computer with [Android platform-tools](https://developer.android.com/tools/releases/platform-tools) (`adb` and `fastboot`).
- `ChangeOS-<version>-arm64-system.img.zst` from the [releases page](https://github.com/ThatMaxwell/ChangeOS/releases), unpacked:

```bash
zstd -d ChangeOS-1.5.0-arm64-system.img.zst -o system.img
```

## Steps

**Unlocking the bootloader erases the phone.**

1. Enable **Developer options** (tap *Build number* 7 times), then turn on **OEM unlocking** and **USB debugging**.
2. Reboot to the bootloader and unlock it:

```bash
adb reboot bootloader
```
```bash
fastboot flashing unlock
```

3. Disable verified boot for the system image, using `vbmeta.img` from your phone's own factory image:

```bash
fastboot --disable-verity --disable-verification flash vbmeta vbmeta.img
```

4. Go to fastbootd (the userspace fastboot that can write the system partition):

```bash
fastboot reboot fastboot
```

5. Flash ChangeOS and wipe data:

```bash
fastboot flash system system.img
```
```bash
fastboot -w
```

6. Reboot:

```bash
fastboot reboot
```

The first boot takes a few minutes.

## Going back

Flash your phone's factory image with the vendor's tool (for Pixels: [flash.android.com](https://flash.android.com)).

## Notes

- ADB is **off** by default on phone builds and asks you to authorize each computer, as stock Android does.
- If `fastboot flash system` says the image is too big, your system partition is smaller than ChangeOS. Run `fastboot delete-logical-partition product` first. That frees space on many phones and is fine for GSIs.
- Please report what works and what doesn't on your phone in [Issues](https://github.com/ThatMaxwell/ChangeOS/issues).
