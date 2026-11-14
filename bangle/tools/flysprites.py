"""Erzeugt die Fliegen-Sprites für bangle/FliesClock.js aus shared/assets/fly/flyex.png
und daraus die Negativ-Uhr bangle/FliesClockNegative.js.

Aufruf: python bangle/tools/flysprites.py
Ersetzt in FliesClock.js den Block zwischen "// <sprites>" und "// </sprites>". FliesClockNegative.js
entsteht vollständig aus FliesClock.js mit eigenen Sprites und eigenem "// <colors>"-Block; nicht von Hand bearbeiten.
Dazu die App-Loader-Icons app.png und app-icon.js (48 × 48) in bangle/bangleapps/fliesclock und fliesclockneg.

Im Original ist der schwarze Körper transparent; sichtbar sind der halbtransparente
helle Rand und die weißen Flügel- und Augenpixel. Für die 8 Farben der Bangle.js 2:
Rand blau, Flügel weiß, einzelne Pixel vorn am Kopf rot.
Negativ auf weißem Grund: Körper schwarz, Flügel weiß, Augen rot, ohne Rand.
"""

import base64
import os
import re

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SHEET = os.path.join(REPO, "shared", "assets", "fly", "flyex.png")
CLOCK = os.path.join(REPO, "bangle", "FliesClock.js")
NEGATIVE = os.path.join(REPO, "bangle", "FliesClockNegative.js")
APPS = os.path.join(REPO, "bangle", "bangleapps")
ICON = 48
# Icon-Paletten wie auf der Uhr (RGB): Index 0 ist hier der Hintergrund, nicht transparent.
ICON_COLORS = {
    "fliesclock": ((0, 0, 0), (0, 0, 255), (255, 255, 255), (255, 0, 0)),
    "fliesclockneg": ((255, 255, 255), (0, 0, 0), (255, 255, 255), (255, 0, 0)),
}

FRAME = 30
SIZE = 22
# Posen: sitzend mit eingeklappten Flügeln, drei Flügelstellungen im Flug, fünf Laufbilder.
# Diagonale Posen liegen 10 Bilder weiter. Sitzend ist Laufbild 5: Bild 4 gleicht ihm bis auf den Kopf,
# dort aber mit ausgestrecktem Rüssel und ohne erkennbare Augen.
POSES = [5, 1, 2, 3, 5, 6, 7, 8, 9]
BODY, HALO, WING, EYE = "body", "halo", "wing", "eye"
# Palettenindex je Pixelklasse, 0 ist transparent.
NORMAL = {BODY: 0, HALO: 1, WING: 2, EYE: 3}
INVERTED = {BODY: 1, HALO: 0, WING: 2, EYE: 3}

NEGATIVE_COLORS = (
    "// <colors> Negativ: weißer Grund, ohne Rand.\n"
    "// Hintergrund; Palette der Sprites: transparent, Körper schwarz, Flügel weiß, Augen rot.\n"
    "const BG = [1, 1, 1];\n"
    "const PALETTE = new Uint16Array([0, g.toColor(0, 0, 0), g.toColor(1, 1, 1), g.toColor(1, 0, 0)]);\n"
    "// </colors>"
)
NEGATIVE_HEADER = (
    "// FliesClockNegative: FliesClock mit schwarzen Fliegen auf weißem Grund.\n"
    "// Erzeugt von bangle/tools/flysprites.py aus FliesClock.js, nicht von Hand bearbeiten.\n"
)


def classify(sheet, index, front):
    """Pixelklassen eines Bildes; `front` ist die Blickrichtung (x, y) des Kopfes."""
    pixels = {}
    for y in range(FRAME):
        for x in range(FRAME):
            r, _, _, a = sheet.getpixel((index * FRAME + x, y))
            if a == 0:
                continue
            if r < 128:
                pixels[(x, y)] = BODY if a == 255 else HALO
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


def pack(pixels, palette):
    """2 bpp, MSB zuerst, auf SIZE × SIZE um die Bildmitte beschnitten."""
    offset = (FRAME - SIZE) // 2
    bits = []
    for y in range(SIZE):
        for x in range(SIZE):
            kind = pixels.get((x + offset, y + offset))
            bits.append(palette[kind] if kind else 0)
    data = bytearray()
    for i in range(0, len(bits), 4):
        chunk = bits[i:i + 4] + [0] * (4 - len(bits[i:i + 4]))
        data.append(chunk[0] << 6 | chunk[1] << 4 | chunk[2] << 2 | chunk[3])
    return base64.b64encode(bytes(data)).decode("ascii")


def sprite_block(frames, palette):
    rows = []
    for images in frames:
        rows.append("  [" + ", ".join(f'"{pack(pixels, palette)}"' for pixels in images) + "]")
    return (
        "// <sprites> erzeugt von bangle/tools/flysprites.py aus shared/assets/fly/flyex.png\n"
        f"const SPRITE_SIZE = {SIZE};\n"
        "// [Pose][Richtung]: Pose 0 sitzt mit eingeklappten Flügeln, 1–3 Flügelschlag, 4–8 Laufen; Richtung 0 = Norden, im Uhrzeigersinn.\n"
        "const SPRITES = [\n" + ",\n".join(rows) + "\n];\n"
        "// </sprites>"
    )


def write_icon(app, pixels, palette):
    """Sitzende Fliege auf das Doppelte vergrößert; app-icon.js im Format des Espruino Image Converters
    (Breite, Höhe, 2 bpp mit Palettenflag 64, Palette RGB565, Daten MSB zuerst), unkomprimiert."""
    colors = ICON_COLORS[app]
    offset = (FRAME - SIZE) // 2
    margin = (ICON - 2 * SIZE) // 2
    indices = [[0] * ICON for _ in range(ICON)]
    for y in range(SIZE):
        for x in range(SIZE):
            kind = pixels.get((x + offset, y + offset))
            index = palette[kind] if kind else 0
            for dy in range(2):
                for dx in range(2):
                    indices[margin + 2 * y + dy][margin + 2 * x + dx] = index
    folder = os.path.join(APPS, app)
    os.makedirs(folder, exist_ok=True)
    image = Image.new("RGB", (ICON, ICON))
    image.putdata([colors[i] for row in indices for i in row])
    image.save(os.path.join(folder, "app.png"))
    data = bytearray([ICON, ICON, 2 | 64])
    for r, g, b in colors:
        rgb565 = (r >> 3) << 11 | (g >> 2) << 5 | b >> 3
        data += bytes([rgb565 & 255, rgb565 >> 8])
    flat = [i for row in indices for i in row]
    for i in range(0, len(flat), 4):
        data.append(flat[i] << 6 | flat[i + 1] << 4 | flat[i + 2] << 2 | flat[i + 3])
    with open(os.path.join(folder, "app-icon.js"), "w", encoding="utf-8", newline="\n") as writer:
        writer.write('atob("' + base64.b64encode(bytes(data)).decode("ascii") + '")\n')
    print("fertig:", folder)


def replace_block(source, name, block):
    updated, count = re.subn(rf"// <{name}>.*?// </{name}>", lambda _: block, source, flags=re.S)
    if count != 1:
        raise SystemExit(f"Markierung // <{name}> ... // </{name}> fehlt in FliesClock.js")
    return updated


def main():
    sheet = Image.open(SHEET).convert("RGBA")
    frames = []
    for pose in POSES:
        images = []
        for direction in range(8):
            diagonal = direction % 2 == 1
            # Gerade Bilder blicken nach Norden, diagonale nach Nordosten.
            pixels = classify(sheet, pose + (10 if diagonal else 0), (0.7, -0.7) if diagonal else (0, -1))
            images.append(rotate(pixels, direction // 2))
        frames.append(images)

    with open(CLOCK, encoding="utf-8") as reader:
        source = reader.read()
    source = replace_block(source, "sprites", sprite_block(frames, NORMAL))
    with open(CLOCK, "w", encoding="utf-8", newline="\n") as writer:
        writer.write(source)
    print("fertig:", CLOCK)

    negative = replace_block(source, "sprites", sprite_block(frames, INVERTED))
    negative = replace_block(negative, "colors", NEGATIVE_COLORS)
    with open(NEGATIVE, "w", encoding="utf-8", newline="\n") as writer:
        writer.write(NEGATIVE_HEADER + negative)
    print("fertig:", NEGATIVE)

    write_icon("fliesclock", frames[0][0], NORMAL)
    write_icon("fliesclockneg", frames[0][0], INVERTED)


if __name__ == "__main__":
    main()
