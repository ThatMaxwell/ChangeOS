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

ROOT = os.environ.get("CHANGEOS_ROOT", "/mnt/c/Users/CARLINHOS/Important/ChangeOS")
IMG = f"{ROOT}/work/system.img"
LABEL = "u:object_r:system_file:s0"
VERSION = "1.0"
CODENAME = "Sweet Vanilla"

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

APPS = {  # dir name -> (apk, extract native libs?, privileged?)
    "AuroraStore": (f"{ROOT}/downloads/aurora/aurora-4.8.4.apk", False, False),
    "Firefox": (f"{ROOT}/downloads/firefox/firefox-158.0-x86_64.apk", True, False),
    # the OS's terminal
    "Termux": (f"{ROOT}/downloads/termux/termux.apk", True, False),
    # Sweet Vanilla home screen, system accent engine and Play ban (built from apps/launcher)
    "ChangeOSLauncher": (os.environ.get("LAUNCHER_APK", f"{ROOT}/apps/launcher/app/build/outputs/apk/release/app-release.apk"), False, True),
}
ETC_FILES = {  # file in the image -> source
    "/system/etc/permissions/privapp-permissions-changeos.xml": f"{ROOT}/build/overlay/privapp-permissions-changeos.xml",
    "/system/etc/sysconfig/changeos-ecm.xml": f"{ROOT}/build/overlay/changeos-ecm.xml",
}

SYSTEM_PROPS = {
    "ro.build.display.id": f"ChangeOS {VERSION} {CODENAME}",
    "ro.changeos.codename": CODENAME,
    "ro.changeos.version": VERSION,
    # Preview build: ADB on by default ("full control"). The GSI is a user build where adbd only
    # starts if persist.sys.usb.config includes adb. Revisit ro.adb.secure before a public release.
    "persist.sys.usb.config": "adb",
    "ro.adb.secure": "0",
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
    for name, (apk, extract, priv) in APPS.items():
        if not os.path.exists(apk):
            print(f"  skipped {name}: {apk} not found")
            continue
        base = f"/system/{'priv-app' if priv else 'app'}/{name}"
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

    print("== etc files")
    for dst, src in ETC_FILES.items():
        parent = dst.rsplit("/", 1)[0]
        if not exists(parent):
            debugfs(mkdir_cmds(parent))
        if exists(dst):
            debugfs([f"rm {dst}"])
        debugfs(put_cmds(src, dst))
        print("  " + dst)

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
    # ro.* props are first-set-wins: also rewrite the display id wherever else the GSI defines it
    for pf in ["/system/etc/prop.default", "/system/system_ext/etc/build.prop", "/system/product/etc/build.prop"]:
        if not exists(pf):
            continue
        with tempfile.TemporaryDirectory() as td:
            debugfs([f"dump {pf} {td}/p"], write=False)
            if "ro.build.display.id=" in open(f"{td}/p", errors="ignore").read():
                edit_props(pf, {"ro.build.display.id": SYSTEM_PROPS["ro.build.display.id"]}, "0100600")
                print("  display id also set in", pf)
    print("  branded as ChangeOS", VERSION)


if __name__ == "__main__":
    main()
