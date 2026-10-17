#!/bin/bash
# Show inode metadata + SELinux label of a few reference paths in work/system.img
IMG=/mnt/c/Users/CARLINHOS/Important/ChangeOS/work/system.img
for p in "$@"; do
  echo "== $p"
  debugfs -R "stat $p" "$IMG" 2>/dev/null | grep -E "Type:|User:|Size:" | head -3
  debugfs -R "ea_list $p" "$IMG" 2>/dev/null
done
