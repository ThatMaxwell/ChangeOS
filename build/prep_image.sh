#!/bin/bash
# Copy the GSI system.img into work/, make it writable (unshare deduped blocks) and grow it.
set -euo pipefail
ROOT=/mnt/c/Users/CARLINHOS/Important/ChangeOS
SIZE=${1:-3400M}
mkdir -p "$ROOT/work"
IMG="$ROOT/work/system.img"
cp "$ROOT/gsi/extracted/system.img" "$IMG"
truncate -s "$SIZE" "$IMG"
echo "-- resize2fs"; resize2fs -f "$IMG" || echo "resize2fs refused (expected with shared_blocks)"
echo "-- unshare"; e2fsck -fy -E unshare_blocks "$IMG" || true
echo "-- resize2fs again"; resize2fs -f "$IMG"
echo "-- fsck"; e2fsck -fy "$IMG" || true
tune2fs -l "$IMG" | grep -E "features|Free blocks|Free inodes|Block count|Inode count"
