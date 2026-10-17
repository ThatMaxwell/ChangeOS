#!/bin/bash
# Sanity-check work/system.img after patch_gsi.py
IMG=/mnt/c/Users/CARLINHOS/Important/ChangeOS/work/system.img
for p in /system/product/app/DeskClock /system/product/app/Gallery2 /system/product/app/Browser2; do
  debugfs -R "stat $p" "$IMG" 2>&1 | grep -q "Inode:" && echo "STILL THERE: $p" || echo "gone: $p"
done
debugfs -R "ls -l /system/app/Firefox" "$IMG" 2>/dev/null | tail -3
debugfs -R "ls -l /system/app/AuroraStore" "$IMG" 2>/dev/null | tail -1
debugfs -R "ls -l /system/media" "$IMG" 2>/dev/null | tail -1
debugfs -R "ea_list /system/app/Firefox/lib/x86_64/libxul.so" "$IMG" 2>/dev/null
debugfs -R "cat /system/build.prop" "$IMG" 2>/dev/null | grep -E "display.id|changeos"
debugfs -R "cat /system/product/etc/build.prop" "$IMG" 2>/dev/null | grep -E "ro.product.product"
