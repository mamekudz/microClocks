"""Legt Materialien, Summton und optional den Fliegen-Scan unter /Game/FlyClock an.

Aufruf über UnrealEditor-Cmd mit -run=pythonscript (siehe run.ps1).
"""

import os
import wave

import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
IMPORT = os.path.join(PROJECT, "Import")
SOUNDS = os.path.normpath(os.path.join(PROJECT, "..", "..", "assets", "fly"))
DEST = "/Game/FlyClock"

# Schleife fly1 aus fly.sounds.json: Schleifenanfang und -ende in Sekunden.
LOOP_START = 2.7042630385487527
LOOP_END = 5.425351473922903

tools = unreal.AssetToolsHelpers.get_asset_tools()
assets = unreal.EditorAssetLibrary
materials = unreal.MaterialEditingLibrary


def scalar(material, name, value, prop, y):
    node = materials.create_material_expression(material, unreal.MaterialExpressionScalarParameter, -400, y)
    node.set_editor_property("parameter_name", name)
    node.set_editor_property("default_value", value)
    materials.connect_material_property(node, "", prop)


def make_material(name, translucent):
    path = f"{DEST}/{name}"
    if assets.does_asset_exist(path):
        assets.delete_asset(path)
    material = tools.create_asset(name, DEST, unreal.Material, unreal.MaterialFactoryNew())
    color = materials.create_material_expression(material, unreal.MaterialExpressionVectorParameter, -400, -200)
    color.set_editor_property("parameter_name", "Color")
    color.set_editor_property("default_value", unreal.LinearColor(0.5, 0.5, 0.5, 1.0))
    materials.connect_material_property(color, "", unreal.MaterialProperty.MP_BASE_COLOR)
    scalar(material, "Roughness", 0.5, unreal.MaterialProperty.MP_ROUGHNESS, 0)
    if translucent:
        material.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        material.set_editor_property("two_sided", True)
        scalar(material, "Opacity", 0.3, unreal.MaterialProperty.MP_OPACITY, 200)
    materials.recompile_material(material)
    assets.save_asset(path)
    unreal.log(f"FlyClock: Material {path}")


def import_file(filename, destination, name=None):
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", filename)
    task.set_editor_property("destination_path", destination)
    if name:
        task.set_editor_property("destination_name", name)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", True)
    tools.import_asset_tasks([task])
    return list(task.get_editor_property("imported_object_paths"))


def make_buzz():
    source = os.path.join(SOUNDS, "fly.sounds.wav")
    os.makedirs(IMPORT, exist_ok=True)
    target = os.path.join(IMPORT, "fly_loop.wav")
    with wave.open(source, "rb") as reader:
        params = reader.getparams()
        rate = reader.getframerate()
        start = int(LOOP_START * rate)
        end = int(LOOP_END * rate)
        reader.setpos(start)
        frames = reader.readframes(end - start)
    with wave.open(target, "wb") as writer:
        writer.setparams(params)
        writer.writeframes(frames)
    import_file(target, DEST, "S_Buzz")
    sound = assets.load_asset(f"{DEST}/S_Buzz")
    if sound:
        sound.set_editor_property("looping", True)
        assets.save_asset(f"{DEST}/S_Buzz")
        unreal.log("FlyClock: Summton importiert")


def enable_nanite(paths):
    for path in paths:
        mesh = assets.load_asset(path)
        if isinstance(mesh, unreal.StaticMesh):
            settings = mesh.get_editor_property("nanite_settings")
            settings.set_editor_property("enabled", True)
            mesh.set_editor_property("nanite_settings", settings)
            assets.save_asset(path)


def import_scan():
    # Die zuletzt abgelegte Datei gewinnt, damit ein neuer Download die Vorlage ersetzt.
    folder = os.path.join(IMPORT, "fly")
    if not os.path.isdir(folder):
        return
    entries = [
        os.path.join(folder, entry) for entry in os.listdir(folder)
        if os.path.splitext(entry)[1].lower() in (".glb", ".gltf", ".fbx", ".obj")
    ]
    if not entries:
        return
    entry = max(entries, key=os.path.getmtime)
    destination = f"{DEST}/Scan"
    if assets.does_directory_exist(destination):
        assets.delete_directory(destination)
    imported = import_file(entry, destination)
    unreal.log(f"FlyClock: Scan {os.path.basename(entry)} -> {imported}")
    enable_nanite(imported)


FOREST = "/Game/Forest"
POLYHAVEN = os.path.join(IMPORT, "polyhaven")


def import_models():
    root = os.path.join(POLYHAVEN, "models")
    if not os.path.isdir(root):
        return
    for name in sorted(os.listdir(root)):
        destination = f"{FOREST}/{name}"
        if assets.does_directory_exist(destination):
            continue
        source = os.path.join(root, name, f"{name}_2k.gltf")
        imported = import_file(source, destination)
        enable_nanite(imported)
        unreal.log(f"FlyClock: Modell {name}: {len(imported)} Assets")


def import_texture(path, destination, kind):
    imported = import_file(path, destination)
    texture = assets.load_asset(imported[0])
    if kind == "normal":
        texture.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
        texture.set_editor_property("srgb", False)
    elif kind == "mask":
        texture.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_MASKS)
        texture.set_editor_property("srgb", False)
    assets.save_asset(imported[0])
    return texture


def ground_layer(material, name, tile, y, mask_kinds):
    folder = os.path.join(POLYHAVEN, "textures", name)
    destination = f"{FOREST}/Ground/{name}"
    maps = {}
    for entry in os.listdir(folder):
        kind = "normal" if "_nor_" in entry else "mask" if "_arm_" in entry else "color"
        maps[kind] = import_texture(os.path.join(folder, entry), destination, kind)

    # Weltkoordinaten in Zentimetern, eine Kachel entspricht der Scangröße.
    world = materials.create_material_expression(material, unreal.MaterialExpressionWorldPosition, -1600, y)
    mask = materials.create_material_expression(material, unreal.MaterialExpressionComponentMask, -1450, y)
    mask.set_editor_property("r", True)
    mask.set_editor_property("g", True)
    materials.connect_material_expressions(world, "", mask, "")
    scale = materials.create_material_expression(material, unreal.MaterialExpressionDivide, -1300, y)
    scale.set_editor_property("const_b", tile)
    materials.connect_material_expressions(mask, "", scale, "A")

    samples = {}
    for row, kind in enumerate(("color", "normal", "mask")):
        sample = materials.create_material_expression(material, unreal.MaterialExpressionTextureSample, -1100, y + row * 220)
        sample.set_editor_property("texture", maps[kind])
        sample.set_editor_property("sampler_type", mask_kinds[kind])
        materials.connect_material_expressions(scale, "", sample, "UVs")
        samples[kind] = sample
    return samples


def make_ground():
    path = f"{FOREST}/M_Ground"
    if assets.does_asset_exist(path):
        assets.delete_asset(path)
    material = tools.create_asset("M_Ground", FOREST, unreal.Material, unreal.MaterialFactoryNew())
    kinds = {
        "color": unreal.MaterialSamplerType.SAMPLERTYPE_COLOR,
        "normal": unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL,
        "mask": unreal.MaterialSamplerType.SAMPLERTYPE_MASKS,
    }
    # Nadelstreu (1,5 m Scan) und Waldboden mit Steinchen (3,15 m), gemischt über weiches Rauschen.
    a = ground_layer(material, "forest_leaves_04", 150.0, -900, kinds)
    b = ground_layer(material, "forest_ground_04", 315.0, 0, kinds)

    world = materials.create_material_expression(material, unreal.MaterialExpressionWorldPosition, -1100, 700)
    noise = materials.create_material_expression(material, unreal.MaterialExpressionNoise, -900, 700)
    noise.set_editor_property("scale", 0.012)
    noise.set_editor_property("levels", 3)
    noise.set_editor_property("output_min", -0.6)
    noise.set_editor_property("output_max", 1.6)
    materials.connect_material_expressions(world, "", noise, "Position")
    blend = materials.create_material_expression(material, unreal.MaterialExpressionSaturate, -750, 700)
    materials.connect_material_expressions(noise, "", blend, "")

    def mix(output_a, output_b, x, y):
        lerp = materials.create_material_expression(material, unreal.MaterialExpressionLinearInterpolate, x, y)
        materials.connect_material_expressions(output_a[0], output_a[1], lerp, "A")
        materials.connect_material_expressions(output_b[0], output_b[1], lerp, "B")
        materials.connect_material_expressions(blend, "", lerp, "Alpha")
        return lerp

    color = mix((a["color"], "RGB"), (b["color"], "RGB"), -500, -600)
    normal = mix((a["normal"], "RGB"), (b["normal"], "RGB"), -500, -300)
    ao = mix((a["mask"], "R"), (b["mask"], "R"), -500, 0)
    rough = mix((a["mask"], "G"), (b["mask"], "G"), -500, 200)
    materials.connect_material_property(color, "", unreal.MaterialProperty.MP_BASE_COLOR)
    materials.connect_material_property(normal, "", unreal.MaterialProperty.MP_NORMAL)
    materials.connect_material_property(ao, "", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)
    materials.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    materials.recompile_material(material)
    assets.save_asset(path)
    unreal.log("FlyClock: Waldboden-Material angelegt")


def make_sky():
    folder = os.path.join(POLYHAVEN, "hdri")
    if not os.path.isdir(folder):
        return
    entry = next(e for e in os.listdir(folder) if e.endswith(".hdr"))
    imported = import_file(os.path.join(folder, entry), f"{FOREST}/Sky", "T_Sky")
    cube = assets.load_asset(imported[0])

    path = f"{FOREST}/M_Sky"
    if assets.does_asset_exist(path):
        assets.delete_asset(path)
    material = tools.create_asset("M_Sky", FOREST, unreal.Material, unreal.MaterialFactoryNew())
    material.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
    material.set_editor_property("two_sided", True)
    view = materials.create_material_expression(material, unreal.MaterialExpressionCameraVectorWS, -700, 0)
    flip = materials.create_material_expression(material, unreal.MaterialExpressionMultiply, -550, 0)
    flip.set_editor_property("const_b", -1.0)
    materials.connect_material_expressions(view, "", flip, "A")
    sample = materials.create_material_expression(material, unreal.MaterialExpressionTextureSampleParameterCube, -350, 0)
    sample.set_editor_property("parameter_name", "Sky")
    sample.set_editor_property("texture", cube)
    materials.connect_material_expressions(flip, "", sample, "UVs")
    materials.connect_material_property(sample, "RGB", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    materials.recompile_material(material)
    assets.save_asset(path)
    unreal.log(f"FlyClock: Himmel {entry}")


MARBLES = "/Game/Marbles"
OXYD = os.path.normpath(os.path.join(PROJECT, "..", "..", "assets", "oxyd"))
TEXTURE_KINDS = {
    "color": unreal.MaterialSamplerType.SAMPLERTYPE_COLOR,
    "normal": unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL,
    "mask": unreal.MaterialSamplerType.SAMPLERTYPE_MASKS,
}


def fresh_material(name, folder):
    path = f"{folder}/{name}"
    if assets.does_asset_exist(path):
        assets.delete_asset(path)
    return path, tools.create_asset(name, folder, unreal.Material, unreal.MaterialFactoryNew())


def make_wood():
    folder = os.path.join(POLYHAVEN, "textures", "oak_veneer_01")
    if not os.path.isdir(folder):
        return
    maps = {}
    for entry in os.listdir(folder):
        kind = "normal" if "_nor_" in entry else "mask" if "_arm_" in entry else "color"
        maps[kind] = import_texture(os.path.join(folder, entry), f"{MARBLES}/Wood", kind)
    path, material = fresh_material("M_Wood", MARBLES)

    # Oben in XY, an den Kanten in YZ oder XZ projiziert, damit die Maserung nirgends verzerrt.
    world = materials.create_material_expression(material, unreal.MaterialExpressionWorldPosition, -1500, 0)
    normal = materials.create_material_expression(material, unreal.MaterialExpressionVertexNormalWS, -1500, 200)
    project = materials.create_material_expression(material, unreal.MaterialExpressionCustom, -1250, 0)
    project.set_editor_property("output_type", unreal.CustomMaterialOutputType.CMOT_FLOAT2)
    inputs = []
    for name in ("P", "N"):
        item = unreal.CustomInput()
        item.set_editor_property("input_name", name)
        inputs.append(item)
    project.set_editor_property("inputs", inputs)
    # Eine Kachel des Scans misst 1,83 m.
    project.set_editor_property("code", (
        "float3 a = abs(N);"
        "float2 uv = a.z >= max(a.x, a.y) ? P.xy : (a.x >= a.y ? P.yz : P.xz);"
        "return uv / 183.0;"
    ))
    materials.connect_material_expressions(world, "", project, "P")
    materials.connect_material_expressions(normal, "", project, "N")

    samples = {}
    for row, kind in enumerate(("color", "normal", "mask")):
        sample = materials.create_material_expression(material, unreal.MaterialExpressionTextureSample, -900, row * 250 - 250)
        sample.set_editor_property("texture", maps[kind])
        sample.set_editor_property("sampler_type", TEXTURE_KINDS[kind])
        materials.connect_material_expressions(project, "", sample, "UVs")
        samples[kind] = sample
    # Geölt statt roh: etwas glatter als der Scan.
    rough = materials.create_material_expression(material, unreal.MaterialExpressionMultiply, -500, 300)
    rough.set_editor_property("const_b", 0.7)
    materials.connect_material_expressions(samples["mask"], "G", rough, "A")
    materials.connect_material_property(samples["color"], "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
    materials.connect_material_property(samples["normal"], "RGB", unreal.MaterialProperty.MP_NORMAL)
    materials.connect_material_property(samples["mask"], "R", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)
    materials.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    materials.recompile_material(material)
    assets.save_asset(path)
    unreal.log("FlyClock: Eichenbrett-Material angelegt")


def make_marbles():
    scratches = assets.load_asset(import_file(os.path.join(OXYD, "pattern.png"), MARBLES, "T_Scratches")[0])
    path, material = fresh_material("M_Marble", MARBLES)

    color = materials.create_material_expression(material, unreal.MaterialExpressionVectorParameter, -900, -300)
    color.set_editor_property("parameter_name", "Color")
    color.set_editor_property("default_value", unreal.LinearColor(0.012, 0.012, 0.014, 1.0))
    coords = materials.create_material_expression(material, unreal.MaterialExpressionTextureCoordinate, -1300, 0)
    coords.set_editor_property("u_tiling", 1.0)
    coords.set_editor_property("v_tiling", 1.0)
    sample = materials.create_material_expression(material, unreal.MaterialExpressionTextureSample, -1100, 0)
    sample.set_editor_property("texture", scratches)
    materials.connect_material_expressions(coords, "", sample, "UVs")
    # Die Kratzer des Oxyd-Musters stehen im Alphakanal. Sie sind matter und etwas heller als das Glas.
    tint = materials.create_material_expression(material, unreal.MaterialExpressionMultiply, -650, -150)
    tint.set_editor_property("const_b", 0.035)
    materials.connect_material_expressions(sample, "A", tint, "A")
    base = materials.create_material_expression(material, unreal.MaterialExpressionAdd, -450, -250)
    materials.connect_material_expressions(color, "", base, "A")
    materials.connect_material_expressions(tint, "", base, "B")
    materials.connect_material_property(base, "", unreal.MaterialProperty.MP_BASE_COLOR)

    matte = materials.create_material_expression(material, unreal.MaterialExpressionMultiply, -650, 100)
    matte.set_editor_property("const_b", 0.14)
    materials.connect_material_expressions(sample, "A", matte, "A")
    rough = materials.create_material_expression(material, unreal.MaterialExpressionAdd, -450, 100)
    rough.set_editor_property("const_b", 0.02)
    materials.connect_material_expressions(matte, "", rough, "A")
    materials.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)

    specular = materials.create_material_expression(material, unreal.MaterialExpressionConstant, -450, 300)
    specular.set_editor_property("r", 0.5)
    materials.connect_material_property(specular, "", unreal.MaterialProperty.MP_SPECULAR)
    materials.recompile_material(material)
    assets.save_asset(path)

    import_file(os.path.join(OXYD, "clack.wav"), MARBLES, "S_Clack")
    unreal.log("FlyClock: Murmeln angelegt")


# -run=pythonscript reicht keine Argumente durch, daher wählt FLYCLOCK_SETUP=marbles nur die Murmelteile.
if os.environ.get("FLYCLOCK_SETUP") != "marbles":
    make_material("M_Solid", False)
    make_material("M_Wing", True)
    make_buzz()
    import_scan()
    import_models()
    make_ground()
    make_sky()
make_wood()
make_marbles()
unreal.log("FlyClock: Einrichtung fertig")
