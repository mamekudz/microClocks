"""Erzeugt die Fliegen-Sprites für bangle/FlyClock.js aus shared/assets/fly/flyex.png.

Aufruf: python bangle/tools/flysprites.py
Ersetzt in FlyClock.js den Block zwischen "// <sprites>" und "// </sprites>".

Im Original ist der schwarze Körper transparent; sichtbar sind der halbtransparente
helle Rand und die weißen Flügel- und Augenpixel. Für die 8 Farben der Bangle.js 2:
Rand blau, Flügel weiß, einzelne Pixel vorn am Kopf rot.
"""

import base64
import os
import re

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SHEET = os.path.join(REPO, "shared", "assets", "fly", "flyex.png")
CLOCK = os.path.join(REPO, "bangle", "FlyClock.js")

FRAME = 30
SIZE = 22
# Posen: sitzend, drei Flügelstellungen im Flug, fünf Laufbilder. Diagonale Posen liegen 10 Bilder weiter.
POSES = [0, 1, 2, 3, 5, 6, 7, 8, 9]
TRANSPARENT, HALO, WING, EYE = 0, 1, 2, 3


def classify(sheet, index, front):
    """Pixelklassen eines Bildes; `front` ist die Blickrichtung (x, y) des Kopfes."""
    pixels = {}
    for y in range(FRAME):
        for x in range(FRAME):
            r, _, _, a = sheet.getpixel((index * FRAME + x, y))
            if a == 0:
                continue
            if r < 128:
                pixels[(x, y)] = TRANSPARENT if a == 255 else HALO
            else:
                pixels[(x, y)] = WING if a == 255 else HALO
    # Kleine weiße Flecken im vorderen Viertel sind die Augen.
    along = {p: p[0] * front[0] + p[1] * front[1] for p in pixels}
    lo, hi = min(along.values()), max(along.values())
    seen = set()
    for start, kind in list(pixels.items()):
        if kind != WING or start in seen:
            continue
        group, stack = [], [start]
        seen.add(start)
        while stack:
            x, y = stack.pop()
            group.append((x, y))
            for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if pixels.get(n) == WING and n not in seen:
                    seen.add(n)
                    stack.append(n)
        if len(group) <= 2 and all(along[p] > hi - (hi - lo) * 0.3 for p in group):
            for p in group:
                pixels[p] = EYE
    return pixels


def rotate(pixels, quarter):
    """Dreht im Uhrzeigersinn um quarter × 90° um die Bildmitte."""
    out = {}
    c = (FRAME - 1) / 2
    for (x, y), kind in pixels.items():
        dx, dy = x - c, y - c
        for _ in range(quarter):
            dx, dy = -dy, dx
        out[(round(dx + c), round(dy + c))] = kind
    return out


def pack(pixels):
    """2 bpp, MSB zuerst, auf SIZE × SIZE um die Bildmitte beschnitten."""
    offset = (FRAME - SIZE) // 2
    bits = []
    for y in range(SIZE):
        for x in range(SIZE):
            bits.append(pixels.get((x + offset, y + offset), TRANSPARENT))
    data = bytearray()
    for i in range(0, len(bits), 4):
        chunk = bits[i:i + 4] + [0] * (4 - len(bits[i:i + 4]))
        data.append(chunk[0] << 6 | chunk[1] << 4 | chunk[2] << 2 | chunk[3])
    return base64.b64encode(bytes(data)).decode("ascii")


def main():
    sheet = Image.open(SHEET).convert("RGBA")
    rows = []
    for pose in POSES:
        images = []
        for direction in range(8):
            diagonal = direction % 2 == 1
            # Gerade Bilder blicken nach Norden, diagonale nach Nordosten.
            pixels = classify(sheet, pose + (10 if diagonal else 0), (0.7, -0.7) if diagonal else (0, -1))
            images.append(pack(rotate(pixels, direction // 2)))
        rows.append("  [" + ", ".join(f'"{image}"' for image in images) + "]")
    block = (
        "// <sprites> erzeugt von bangle/tools/flysprites.py aus shared/assets/fly/flyex.png\n"
        f"const SPRITE_SIZE = {SIZE};\n"
        "// [Pose][Richtung]: Pose 0 sitzt, 1–3 Flügelschlag, 4–8 Laufen; Richtung 0 = Norden, im Uhrzeigersinn.\n"
        "const SPRITES = [\n" + ",\n".join(rows) + "\n];\n"
        "// </sprites>"
    )
    with open(CLOCK, encoding="utf-8") as reader:
        source = reader.read()
    updated, count = re.subn(r"// <sprites>.*?// </sprites>", lambda _: block, source, flags=re.S)
    if count != 1:
        raise SystemExit("Markierung // <sprites> ... // </sprites> fehlt in FlyClock.js")
    with open(CLOCK, "w", encoding="utf-8", newline="\n") as writer:
        writer.write(updated)
    print("fertig:", CLOCK)


if __name__ == "__main__":
    main()
