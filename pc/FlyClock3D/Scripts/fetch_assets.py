"""Lädt die CC0-Assets für die Waldszene und die Untergründe von Poly Haven nach Import/polyhaven.

Aufruf: python Scripts/fetch_assets.py   (bereits vorhandene Dateien werden übersprungen)
"""

import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(os.path.dirname(HERE), "Import", "polyhaven")
API = "https://api.polyhaven.com/files/"

# Die letzten drei sind die hellen Untergründe für die Fliegen (Sand, Gras, Straße).
TEXTURES = ["forest_leaves_04", "forest_ground_04", "oak_veneer_01", "sand_01", "leafy_grass", "asphalt_06"]
TEXTURE_MAPS = ["Diffuse", "nor_dx", "arm"]
MODELS = [
    "moss_01", "pine_roots", "tree_stump_01", "tree_stump_02", "rock_moss_set_01",
    "rock_moss_set_02", "dry_branches_medium_01", "fern_02", "dead_tree_trunk",
    "root_cluster_01", "fir_sapling",
]
HDRI = "forest_slope"


def fetch(url, path):
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    print("lade", url)
    request = urllib.request.Request(url, headers={"User-Agent": "FlyClock3D"})
    with urllib.request.urlopen(request) as response, open(path + ".part", "wb") as out:
        while chunk := response.read(1 << 20):
            out.write(chunk)
    os.replace(path + ".part", path)


def files(asset):
    request = urllib.request.Request(API + asset, headers={"User-Agent": "FlyClock3D"})
    with urllib.request.urlopen(request) as response:
        return json.load(response)


for name in TEXTURES:
    info = files(name)
    for kind in TEXTURE_MAPS:
        url = info[kind]["4k"]["jpg"]["url"]
        fetch(url, os.path.join(TARGET, "textures", name, os.path.basename(url)))

for name in MODELS:
    gltf = files(name)["gltf"]["2k"]["gltf"]
    folder = os.path.join(TARGET, "models", name)
    fetch(gltf["url"], os.path.join(folder, os.path.basename(gltf["url"])))
    for relative, item in gltf["include"].items():
        fetch(item["url"], os.path.join(folder, relative))

hdri = files(HDRI)["hdri"]["4k"]["hdr"]["url"]
fetch(hdri, os.path.join(TARGET, "hdri", os.path.basename(hdri)))
print("fertig")
