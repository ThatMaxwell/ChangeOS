#!/bin/bash
# List the apps and media inside a GSI system.img (read-only).
IMG=${1:-/mnt/c/Users/CARLINHOS/Important/ChangeOS/gsi/extracted/system.img}
for d in /system/app /system/priv-app /system/product/app /system/product/priv-app \
         /system/system_ext/app /system/system_ext/priv-app /system/media; do
  echo "== $d"
  debugfs -R "ls -p $d" "$IMG" 2>/dev/null | awk -F/ 'NF>5 && $6!="." && $6!=".." {printf "%s ", $6}'
  echo
done
