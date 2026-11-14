#!/usr/bin/env python3
"""app/icons/icon.svg ile aynı tasarımda PNG ikonlar üretir (bağımlılıksız).

Android'de "Ana ekrana ekle" için PNG ikon gerekir. SVG değişirse buradaki şekiller de güncellenmeli.

Kullanım: python3 scripts/make_icons.py
"""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "app" / "icons"
TEAL = (0x2F, 0x6F, 0x6A)
WHITE = (0xFF, 0xFF, 0xFF)
AMBER = (0xC9, 0x82, 0x2B)


def in_rrect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def in_tri(x, y, a, b, c):
    def s(p, q, r):
        return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
    d1, d2, d3 = s((x, y), a, b), s((x, y), b, c), s((x, y), c, a)
    neg = d1 < 0 or d2 < 0 or d3 < 0
    pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (neg and pos)


def color_at(x, y, maskable):
    """512'lik tasarım koordinatlarında (x, y) noktasının rengi; None = saydam."""
    if maskable:
        # Maskable ikonlarda arka plan tam kare, içerik güvenli bölgeye (%80) sığdırılır
        x, y = 256 + (x - 256) / 0.8, 256 + (y - 256) / 0.8
        bg = TEAL
    else:
        bg = TEAL if in_rrect(x, y, 0, 0, 512, 512, 112) else None
    if in_rrect(x, y, 152, 188, 360, 214, 13):
        return TEAL
    if in_rrect(x, y, 152, 252, 288, 278, 13):
        return AMBER
    if in_rrect(x, y, 96, 132, 416, 340, 40) or in_tri(x, y, (164, 330), (236, 330), (164, 396)):
        return WHITE
    return bg


def render(size, maskable=False, ss=3):
    scale = 512 / size
    rows = []
    for py in range(size):
        row = bytearray([0])  # PNG filtre baytı
        for px in range(size):
            r = g = b = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    c = color_at((px + (sx + .5) / ss) * scale, (py + (sy + .5) / ss) * scale, maskable)
                    if c:
                        r += c[0]; g += c[1]; b += c[2]; a += 1
            n = ss * ss
            row += bytes([r // a, g // a, b // a, 255 * a // n] if a else [0, 0, 0, 0])
        rows.append(bytes(row))
    return b"".join(rows)


def png(path: Path, size: int, raw: bytes):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
                     + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    print(f"yazıldı: {path}")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    png(OUT / "icon-192.png", 192, render(192))
    png(OUT / "icon-512.png", 512, render(512, ss=2))
    png(OUT / "icon-maskable-512.png", 512, render(512, maskable=True, ss=2))
