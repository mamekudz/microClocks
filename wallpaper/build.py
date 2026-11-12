"""Packt das Web-Wallpaper für Wallpaper Engine nach dist/wallpaper.

Aufruf: python wallpaper/build.py
In Wallpaper Engine dann "Wallpaper erstellen" und dist/wallpaper/index.html wählen.
"""

import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SHARED = os.path.join(REPO, "shared")
TARGET = os.path.join(REPO, "dist", "wallpaper")
MODULES = ["buzz.js", "clack.js", "flies.js", "floors.js", "glyphs.js", "marbles.js", "oxyd.js"]
ASSETS = [
    "fly/flyex.png", "fly/fly.sounds.wav", "fly/fly.sounds.json", "oxyd/clack.wav", "oxyd/pattern.png",
    "oxyd/floors/slate.png", "oxyd/floors/beech.png", "oxyd/floors/planks.png",
] + [f"oxyd/{name}.png" for name in ("black", "white", "red", "green", "blue", "yellow", "magenta", "cyan")]


def copy(source, target):
    os.makedirs(os.path.dirname(target), exist_ok=True)
    shutil.copy2(source, target)


if os.path.isdir(TARGET):
    shutil.rmtree(TARGET)

for name in MODULES:
    copy(os.path.join(SHARED, "faces", name), os.path.join(TARGET, "faces", name))
for name in ASSETS:
    copy(os.path.join(SHARED, "assets", name), os.path.join(TARGET, "assets", name))
for name in ("index.html", "project.json"):
    copy(os.path.join(HERE, name), os.path.join(TARGET, name))

# Im Paket liegen faces/ und assets/ neben index.html statt unter ../shared.
with open(os.path.join(HERE, "wallpaper.js"), encoding="utf-8") as reader:
    script = reader.read()
script = script.replace('from "../shared/faces/', 'from "./faces/').replace('const ROOT = "../shared";', 'const ROOT = ".";')
with open(os.path.join(TARGET, "wallpaper.js"), "w", encoding="utf-8") as writer:
    writer.write(script)

print("fertig:", TARGET)
