#!/usr/bin/env python3
"""Generate 5 round button icons (120x120) for StarLine Zepp app."""

import os
import math
from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'app')
SIZE = 120
R = SIZE // 2


def circle_bg(color):
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, SIZE - 1, SIZE - 1], fill=color)
    return img, d


def draw_engine(img, d, color=(255, 255, 255)):
    """Simple engine silhouette: block + intake manifold."""
    cx, cy = SIZE // 2, SIZE // 2
    # Engine block
    d.rectangle([cx - 22, cy - 14, cx + 22, cy + 18], fill=color)
    # Cylinders on top
    for i in range(3):
        bx = cx - 16 + i * 16
        d.rectangle([bx, cy - 26, bx + 10, cy - 14], fill=color)
    # Crankshaft pulley
    d.ellipse([cx - 10, cy + 14, cx + 10, cy + 34], fill=color)
    d.ellipse([cx - 5, cy + 19, cx + 5, cy + 29], fill=(0, 0, 0, 0))
    # Exhaust pipe
    d.rectangle([cx + 22, cy + 2, cx + 34, cy + 10], fill=color)


def draw_lock_open(img, d, color=(255, 255, 255)):
    """Open padlock icon."""
    cx, cy = SIZE // 2, SIZE // 2
    # Shackle (arc, open on right)
    for angle in range(180, 361):
        rad = math.radians(angle)
        x = cx - 12 + int(14 * math.cos(rad))
        y = cy - 16 + int(14 * math.sin(rad))
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=color)
    # Body
    d.rectangle([cx - 18, cy - 6, cx + 18, cy + 20], fill=color)
    # Keyhole
    d.ellipse([cx - 5, cy + 2, cx + 5, cy + 12], fill=(0, 0, 0, 0))
    d.rectangle([cx - 3, cy + 9, cx + 3, cy + 18], fill=(0, 0, 0, 0))


def draw_lock_closed(img, d, color=(255, 255, 255)):
    """Closed padlock icon."""
    cx, cy = SIZE // 2, SIZE // 2
    # Shackle (full arc)
    for angle in range(0, 181):
        rad = math.radians(angle)
        x = cx + int(14 * math.cos(rad))
        y = cy - 14 + int(14 * math.sin(rad))
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=color)
    # Body
    d.rectangle([cx - 18, cy - 6, cx + 18, cy + 20], fill=color)
    # Keyhole
    d.ellipse([cx - 5, cy + 2, cx + 5, cy + 12], fill=(0, 0, 0, 0))
    d.rectangle([cx - 3, cy + 9, cx + 3, cy + 18], fill=(0, 0, 0, 0))


def draw_refresh(img, d, color=(255, 255, 255)):
    """Circular refresh/restart arrow."""
    cx, cy = SIZE // 2, SIZE // 2
    r_outer = 28
    r_inner = 18
    # Draw arc (270 degrees, leaving gap for arrowhead)
    for angle in range(50, 360):
        rad = math.radians(angle)
        for r in range(r_inner, r_outer + 1):
            x = cx + int(r * math.cos(rad))
            y = cy + int(r * math.sin(rad))
            d.point([x, y], fill=color)
    # Arrowhead pointing down-left at angle ~45 deg
    tip_x = cx + int(r_outer * math.cos(math.radians(45)))
    tip_y = cy + int(r_outer * math.sin(math.radians(45)))
    arrow_pts = [
        (tip_x, tip_y),
        (tip_x - 14, tip_y + 2),
        (tip_x + 2, tip_y + 14),
    ]
    d.polygon(arrow_pts, fill=color)


ICONS = [
    ('btn_engine_off.png', (0x1e, 0x8a, 0x1e, 255), draw_engine),
    ('btn_engine_on.png',  (0x8b, 0x1a, 0x1a, 255), draw_engine),
    ('btn_alarm_off.png',  (0x1a, 0x5c, 0x8a, 255), draw_lock_open),
    ('btn_alarm_on.png',   (0x1a, 0x5c, 0x8a, 255), draw_lock_closed),
    ('btn_refresh.png',    (0x33, 0x33, 0x33, 255), draw_refresh),
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for fname, bg_color, draw_fn in ICONS:
        img, d = circle_bg(bg_color)
        draw_fn(img, d)
        path = os.path.join(OUT_DIR, fname)
        img.save(path)
        print(f'  wrote {path}')
    print('Done.')


if __name__ == '__main__':
    main()
