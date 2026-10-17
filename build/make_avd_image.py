"""Build avd-image/: the emulator's Android 17 base image with our patched GSI inside its super disk.

Run with Windows Python after build/patch_gsi.py:  python build/make_avd_image.py
"""
import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = Path(os.environ.get("BASE_IMAGE", Path.home() / "AppData/Local/Android/Sdk/system-images/android-37.0/google_apis/x86_64"))
DST = ROOT / "avd-image"
GSI = ROOT / "work/system.img"
SUPER_OFFSET = 4096 * 512   # GPT partition 2
VBMETA_OFFSET = 2048 * 512  # GPT partition 1


def main():
    DST.mkdir(exist_ok=True)
    for f in BASE.iterdir():
        if f.is_file():
            print("copy", f.name)
            shutil.copy2(f, DST / f.name)
        elif f.name == "data":
            shutil.copytree(f, DST / "data", dirs_exist_ok=True)
    disk = DST / "system.img"

    print("== super: put ChangeOS system in")
    subprocess.run([sys.executable, str(ROOT / "build/lptool.py"), "gsi", str(disk), str(SUPER_OFFSET), str(GSI)],
                   check=True)

    print("== vbmeta: disable verity + verification")
    with open(disk, "r+b") as f:
        f.seek(VBMETA_OFFSET)
        assert f.read(4) == b"AVB0"
        f.seek(VBMETA_OFFSET + 120)
        f.write(struct.pack(">I", 3))

    # GPU readback over DMA (GLDMA/GLDMA2) crashes screencap and SurfaceFlinger's RegionSampling
    # with this system ("hasReadColorBufferDma" assertion), so switch both off
    feats = DST / "advancedFeatures.ini"
    if feats.exists():
        txt = feats.read_text().replace("GLDMA = on", "GLDMA = off").replace("GLDMA2 = on", "GLDMA2 = off")
        if "GLDMA2" not in txt:
            txt += "GLDMA2 = off\n"
        feats.write_text(txt)

    # The emulator passes these to Android as boot params. A locked device rejects a modified system
    # ("PUBLIC_KEY_REJECTED isn't allowed"), so boot it the way an unlocked phone runs a custom ROM.
    (DST / "VerifiedBootParams.textproto").write_text(
        'major_version: 2\n'
        'param: "androidboot.verifiedbootstate=orange"\n'
        'param: "androidboot.vbmeta.device_state=unlocked"\n'
    )
    print("done:", DST)


if __name__ == "__main__":
    main()
