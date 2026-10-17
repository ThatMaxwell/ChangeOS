#!/usr/bin/env python3
"""Apply ChangeOS changes to work/system.img with debugfs (run inside WSL after prep_image.sh).

- debloat: remove stock AOSP apps ChangeOS doesn't ship
- add Aurora Store + Firefox as system apps
- add the ChangeOS boot animation
- rebrand build props
"""
import os
import re
import subprocess
import tempfile
import zipfile

ROOT = "/mnt/c/Users/CARLINHOS/Important/ChangeOS"
IMG = f"{ROOT}/work/system.img"
LABEL = "u:object_r:system_file:s0"
VERSION = "0.1"

DEBLOAT = [
    "/system/product/app/Browser2",       # replaced by Firefox
    "/system/product/app/Calendar",
    "/system/product/app/DeskClock",
    "/system/product/app/Gallery2",
    "/system/product/app/Music",
    "/system/product/app/PhotoTable",
    "/system/product/app/QuickSearchBox",
    "/system/app/EasterEgg",
    "/system/app/BasicDreams",
    "/system/app/BookmarkProvider",
    "/system/app/PartnerBookmarksProvider",
]

APPS = {  # dir name -> (apk, extract native libs?)
    "AuroraStore": (f"{ROOT}/downloads/aurora/aurora-4.8.4.apk", False),
    "Firefox": (f"{ROOT}/downloads/firefox/firefox-158.0-x86_64.apk", True),
}

SYSTEM_PROPS = {
    "ro.build.display.id": f"ChangeOS {VERSION} (DP11.260918.006)",
    "ro.changeos.version": VERSION,
}
PRODUCT_PROPS = {
    "ro.product.product.brand": "ChangeOS",
    "ro.product.product.manufacturer": "ChangeOS",
    "ro.product.product.model": "ChangeOS",
    "ro.product.product.name": "changeos",
}


def debugfs(cmds, write=True):
    with tempfile.NamedTemporaryFile("w", suffix=".cmds", delete=False) as f:
        f.write("\n".join(cmds) + "\n")
        path = f.name
    args = ["debugfs"] + (["-w"] if write else []) + ["-f", path, IMG]
    out = subprocess.run(args, capture_output=True, text=True)
    os.unlink(path)
    errs = [l for l in out.stderr.splitlines() if l and not l.startswith("debugfs ")]
    if errs:
        print("  debugfs:", *errs[:8], sep="\n    ")
    return out.stdout


def ls(path):
    """[(name, is_dir)] using `ls -p` (format: /inode/mode/uid/gid/name/size/)."""
    out = debugfs([f"ls -p {path}"], write=False)
    items = []
    for line in out.splitlines():
        parts = line.split("/")
        if len(parts) >= 7 and parts[5] not in (".", ".."):
            items.append((parts[5], parts[2].startswith("04")))
    return items


def exists(path):
    out = subprocess.run(["debugfs", "-R", f"stat {path}", IMG], capture_output=True, text=True)
    return "Inode:" in out.stdout


def rm_tree_cmds(path):
    cmds = []
    for name, is_dir in ls(path):
        child = f"{path}/{name}"
        cmds += rm_tree_cmds(child) if is_dir else [f"rm {child}"]
    return cmds + [f"rmdir {path}"]


LABEL_FILE = None


def meta(path, mode):
    return [f"sif {path} mode {mode}", f"sif {path} uid 0", f"sif {path} gid 0",
            f"ea_set -f {LABEL_FILE} {path} security.selinux"]


def mkdir_cmds(path):
    return [f"mkdir {path}"] + meta(path, "040755")


def put_cmds(local, path, mode="0100644"):
    return [f"write {local} {path}"] + meta(path, mode)


def edit_props(path, props, mode):
    with tempfile.TemporaryDirectory() as td:
        local = f"{td}/build.prop"
        debugfs([f"dump {path} {local}"], write=False)
        text = open(local).read()
        for k, v in props.items():
            line = f"{k}={v}"
            if re.search(rf"^{re.escape(k)}=.*$", text, re.M):
                text = re.sub(rf"^{re.escape(k)}=.*$", line, text, flags=re.M)
            else:
                text += ("" if text.endswith("\n") else "\n") + line + "\n"
        open(local, "w").write(text)
        debugfs([f"rm {path}"] + put_cmds(local, path, mode))


def main():
    global LABEL_FILE
    work = tempfile.mkdtemp()
    LABEL_FILE = f"{work}/label"
    open(LABEL_FILE, "wb").write(LABEL.encode() + b"\0")

    print("== debloat")
    for d in DEBLOAT:
        if exists(d):
            debugfs(rm_tree_cmds(d))
            print("  removed", d)

    print("== apps")
    for name, (apk, extract) in APPS.items():
        base = f"/system/app/{name}"
        if exists(base):
            debugfs(rm_tree_cmds(base))
        cmds = mkdir_cmds(base) + put_cmds(apk, f"{base}/{name}.apk")
        if extract:
            libdir = f"{work}/{name}-lib"
            os.makedirs(libdir)
            with zipfile.ZipFile(apk) as z:
                libs = [n for n in z.namelist() if n.startswith("lib/x86_64/") and n.endswith(".so")]
                for n in libs:
                    with open(f"{libdir}/{os.path.basename(n)}", "wb") as out:
                        out.write(z.read(n))
            cmds += mkdir_cmds(f"{base}/lib") + mkdir_cmds(f"{base}/lib/x86_64")
            for so in sorted(os.listdir(libdir)):
                cmds += put_cmds(f"{libdir}/{so}", f"{base}/lib/x86_64/{so}")
        debugfs(cmds)
        print(f"  added {base}" + (f" (+{len(os.listdir(libdir))} libs)" if extract else ""))

    print("== boot animation")
    if not exists("/system/media"):
        debugfs(mkdir_cmds("/system/media"))
    if exists("/system/media/bootanimation.zip"):
        debugfs(["rm /system/media/bootanimation.zip"])
    debugfs(put_cmds(f"{ROOT}/out/bootanimation.zip", "/system/media/bootanimation.zip"))
    print("  /system/media/bootanimation.zip")

    print("== props")
    edit_props("/system/build.prop", SYSTEM_PROPS, "0100600")
    edit_props("/system/product/etc/build.prop", PRODUCT_PROPS, "0100600")
    print("  branded as ChangeOS", VERSION)


if __name__ == "__main__":
    main()
