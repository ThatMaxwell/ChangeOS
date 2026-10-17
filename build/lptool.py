"""Minimal reader/editor for Android logical-partition (super) metadata.

Format reference: system/core/fs_mgr/liblp/include/liblp/metadata_format.h

Usage:
  python build/lptool.py dump  <disk.img> <super_offset_bytes>
  python build/lptool.py gsi   <disk.img> <super_offset_bytes> <system.img>
      Removes every logical partition except `system`, gives system one
      contiguous extent big enough for <system.img>, rewrites all metadata
      slots, then writes <system.img> into that extent.
"""
import hashlib
import struct
import sys

SECTOR = 512
GEOMETRY_MAGIC = 0x616C4467
HEADER_MAGIC = 0x414C5030
RESERVED = 4096
GEOMETRY_SIZE = 4096

PART_FMT = "<36sIIII"  # name, attributes, first_extent_index, num_extents, group_index
EXT_FMT = "<QIQI"  # num_sectors, target_type, target_data, target_source
GRP_FMT = "<36sIQ"  # name, flags, maximum_size
DEV_FMT = "<QIIQ36sI"  # first_logical_sector, alignment, alignment_offset, size, name, flags


def cstr(b):
    return b.split(b"\0", 1)[0].decode()


class Super:
    def __init__(self, f, base):
        self.f, self.base = f, base
        f.seek(base + RESERVED)
        g = f.read(GEOMETRY_SIZE)
        magic, self.geo_size = struct.unpack_from("<II", g, 0)
        assert magic == GEOMETRY_MAGIC, f"bad geometry magic {magic:#x}"
        self.max_size, self.slots, self.block_size = struct.unpack_from("<III", g, 40)
        self.read_metadata()

    def slot_offset(self, slot, backup=False):
        primary = self.base + RESERVED + 2 * GEOMETRY_SIZE
        if backup:
            return primary + self.slots * self.max_size + slot * self.max_size
        return primary + slot * self.max_size

    def read_metadata(self, slot=0):
        self.f.seek(self.slot_offset(slot))
        raw = self.f.read(self.max_size)
        (magic, self.major, self.minor, self.hdr_size) = struct.unpack_from("<IHHI", raw, 0)
        assert magic == HEADER_MAGIC, f"bad header magic {magic:#x}"
        self.header = bytearray(raw[: self.hdr_size])
        self.tables_size = struct.unpack_from("<I", raw, 44)[0]
        desc = struct.unpack_from("<12I", raw, 80)
        tables = raw[self.hdr_size: self.hdr_size + self.tables_size]

        def table(i, fmt):
            off, num, size = desc[i * 3: i * 3 + 3]
            return [struct.unpack_from(fmt, tables, off + k * size) for k in range(num)]

        self.parts = [list(p) for p in table(0, PART_FMT)]
        self.extents = [list(e) for e in table(1, EXT_FMT)]
        self.groups = [list(g) for g in table(2, GRP_FMT)]
        self.devices = [list(d) for d in table(3, DEV_FMT)]

    def dump(self):
        print(f"metadata v{self.major}.{self.minor}, max_size={self.max_size}, slots={self.slots}")
        for d in self.devices:
            print(f"device {cstr(d[4])}: first_logical_sector={d[0]} size={d[3]} ({d[3] / 2**30:.2f} GiB) align={d[1]}")
        for g in self.groups:
            print(f"group {cstr(g[0])}: max={g[2]}")
        for p in self.parts:
            exts = self.extents[p[2]: p[2] + p[3]]
            size = sum(e[0] for e in exts) * SECTOR
            where = ", ".join(f"@{e[2]}+{e[0]}" for e in exts)
            print(f"part {cstr(p[0]):<16} attr={p[1]} group={cstr(self.groups[p[4]][0])} size={size / 2**20:.0f} MiB  {where}")

    def serialize(self):
        tables = b""
        descs = []
        for rows, fmt in ((self.parts, PART_FMT), (self.extents, EXT_FMT), (self.groups, GRP_FMT),
                          (self.devices, DEV_FMT)):
            size = struct.calcsize(fmt)
            descs += [len(tables), len(rows), size]
            tables += b"".join(struct.pack(fmt, *r) for r in rows)
        hdr = bytearray(self.header)
        struct.pack_into("<I", hdr, 44, len(tables))
        hdr[48:80] = hashlib.sha256(tables).digest()
        struct.pack_into("<12I", hdr, 80, *descs)
        hdr[12:44] = b"\0" * 32
        hdr[12:44] = hashlib.sha256(bytes(hdr)).digest()
        blob = bytes(hdr) + tables
        assert len(blob) <= self.max_size
        return blob

    def write_all_slots(self):
        blob = self.serialize()
        for s in range(self.slots):
            for backup in (False, True):
                self.f.seek(self.slot_offset(s, backup))
                self.f.write(blob)

    def make_gsi_layout(self, image_bytes, drop=("system_ext", "product")):
        """Drop `drop` partitions, then lay `system` over every free range. Returns [(byte_off, byte_len)]."""
        dev = self.devices[0]
        align = max(dev[1], 1 << 20) // SECTOR
        keep = [p for p in self.parts if cstr(p[0]) not in drop and cstr(p[0]) != "system"]
        used = sorted((e[2], e[2] + e[0]) for p in keep for e in self.extents[p[2]: p[2] + p[3]])
        free, cur = [], -(-dev[0] // align) * align
        for s, e in used + [(dev[3] // SECTOR, dev[3] // SECTOR)]:
            if s > cur:
                free.append((cur, s))
            cur = max(cur, -(-e // align) * align)
        need = -(-image_bytes // SECTOR)
        sys_ext, left = [], need
        for s, e in free:
            if left <= 0:
                break
            n = min(e - s, left)
            sys_ext.append([n, 0, s, 0])  # LP_TARGET_TYPE_LINEAR on block device 0
            left -= n
        assert left <= 0, f"system image too big for super: {left} sectors short"
        sysp = next(p for p in self.parts if cstr(p[0]) == "system")
        new_parts, new_ext = [], []
        for p in [sysp] + keep:
            exts = sys_ext if p is sysp else self.extents[p[2]: p[2] + p[3]]
            p[2], p[3] = len(new_ext), len(exts)
            new_ext += exts
            new_parts.append(p)
        self.parts, self.extents = new_parts, new_ext
        return [(e[2] * SECTOR, e[0] * SECTOR) for e in sys_ext]


def main():
    cmd, disk, base = sys.argv[1], sys.argv[2], int(sys.argv[3])
    mode = "rb" if cmd == "dump" else "r+b"
    with open(disk, mode) as f:
        sp = Super(f, base)
        if cmd == "dump":
            sp.dump()
            return
        if cmd == "gsi":
            img = sys.argv[4]
            size = __import__("os").path.getsize(img)
            ranges = sp.make_gsi_layout(size)
            sp.write_all_slots()
            with open(img, "rb") as src:
                for off, length in ranges:
                    f.seek(base + off)
                    while length > 0:
                        chunk = src.read(min(16 << 20, length))
                        if not chunk:
                            break
                        f.write(chunk)
                        length -= len(chunk)
            print(f"system written ({size / 2**20:.0f} MiB) across {len(ranges)} extent(s); system_ext/product dropped")
            Super(f, base).dump()


if __name__ == "__main__":
    main()
