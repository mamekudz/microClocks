"""Packt das Web-Wallpaper für Wallpaper Engine nach dist/wallpaper.

Aufruf: python wallpaper/build.py
In Wallpaper Engine dann "Wallpaper erstellen" und dist/wallpaper/index.html wählen.

project.json enthält die en-US-Quelltexte. Für die Eigenschaften legt das Skript die Wallpaper-Engine-Lokalisierung
(ui_-Schlüssel je Sprache) aus i18x/wallpaper/<lid>.json an; die Beschreibung, die Wallpaper Engine nicht übersetzt,
kommt in der Sprache des Rechners (MICROGULP_LANG, sonst Windows-Einstellung).
"""

import ctypes
import glob
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SHARED = os.path.join(REPO, "shared")
I18X = os.path.join(REPO, "i18x", "wallpaper")
TARGET = os.path.join(REPO, "dist", "wallpaper")
MODULES = ["buzz.js", "clack.js", "flies.js", "floors.js", "glyphs.js", "marbles.js", "oxyd.js"]
ASSETS = [
    "fly/flyex.png", "fly/fly.sounds.wav", "fly/fly.sounds.json", "oxyd/clack.wav", "oxyd/pattern.png",
    "oxyd/floors/slate.png", "oxyd/floors/beech.png", "oxyd/floors/planks.png",
] + [f"oxyd/{name}.png" for name in ("black", "white", "red", "green", "blue", "yellow", "magenta", "cyan")]


def copy(source, target):
    os.makedirs(os.path.dirname(target), exist_ok=True)
    shutil.copy2(source, target)


def machine_language():
    wanted = os.environ.get("MICROGULP_LANG")
    if wanted:
        return wanted
    try:
        buffer = ctypes.create_unicode_buffer(85)
        if ctypes.windll.kernel32.GetUserDefaultLocaleName(buffer, len(buffer)):
            return buffer.value
    except (AttributeError, OSError):
        pass
    return "en-US"


def localize(project):
    tables = {"en-us": {}}
    translations = {}
    for path in glob.glob(os.path.join(I18X, "*.json")):
        lid = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8") as reader:
            translations[lid] = json.load(reader)
        tables[lid.lower()] = {}

    def register(ui_key, text):
        key = f'{text}<context="wallpaper property"/>'
        tables["en-us"][ui_key] = text
        for lid, table in translations.items():
            tables[lid.lower()][ui_key] = table.get(key) or text
        return ui_key

    for name, prop in project["general"]["properties"].items():
        prop["text"] = register(f"ui_{name}", prop["text"])
        for option in prop.get("options", []):
            option["label"] = register(f"ui_{name}_{option['value']}".replace("-", "_"), option["label"])
    project["general"]["localization"] = tables

    language = machine_language()
    table = translations.get(language) or next((t for lid, t in translations.items() if lid.split("-")[0] == language.split("-")[0]), {})
    project["description"] = table.get(f'{project["description"]}<context="wallpaper description"/>') or project["description"]


if os.path.isdir(TARGET):
    shutil.rmtree(TARGET)

for name in MODULES:
    copy(os.path.join(SHARED, "faces", name), os.path.join(TARGET, "faces", name))
for name in ASSETS:
    copy(os.path.join(SHARED, "assets", name), os.path.join(TARGET, "assets", name))
copy(os.path.join(HERE, "index.html"), os.path.join(TARGET, "index.html"))

with open(os.path.join(HERE, "project.json"), encoding="utf-8") as reader:
    project = json.load(reader)
localize(project)
with open(os.path.join(TARGET, "project.json"), "w", encoding="utf-8") as writer:
    json.dump(project, writer, ensure_ascii=False, indent="\t")

# Im Paket liegen faces/ und assets/ neben index.html statt unter ../shared.
with open(os.path.join(HERE, "wallpaper.js"), encoding="utf-8") as reader:
    script = reader.read()
script = script.replace('from "../shared/faces/', 'from "./faces/').replace('const ROOT = "../shared";', 'const ROOT = ".";')
with open(os.path.join(TARGET, "wallpaper.js"), "w", encoding="utf-8") as writer:
    writer.write(script)

print("done:", TARGET)
