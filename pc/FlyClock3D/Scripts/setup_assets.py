"""Legt Materialien, Summton und optional den Fliegen-Scan unter /Game/FlyClock an.

Aufruf über UnrealEditor-Cmd mit -run=pythonscript (siehe run.ps1).
"""

import array
import os
import wave

import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
IMPORT = os.path.join(PROJECT, "Import")
SOUNDS = os.path.normpath(os.path.join(PROJECT, "..", "..", "shared", "assets", "fly"))
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
    # Die Schleife ist in der Aufnahme sehr leise (Spitze 0,04); auf eine Spitze von 0,9 anheben.
    if params.sampwidth == 2:
        samples = array.array("h", frames)
        peak = max(1, max(abs(value) for value in samples))
        gain = 0.9 * 32767 / peak
        samples = array.array("h", (max(-32768, min(32767, int(value * gain))) for value in samples))
        frames = samples.tobytes()
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
    # Fester Name, weil das gepackte Spiel den Ordner nicht über die Asset-Registry durchsuchen kann.
    for index, path in enumerate(imported):
        if isinstance(assets.load_asset(path), unreal.StaticMesh):
            target = f"{destination}/SM_Fly"
            assets.rename_asset(path, target)
            imported[index] = target
            break
    unreal.log(f"FlyClock: Scan {os.path.basename(entry)} -> {imported}")


# Bewegung des Scans im Netzraum (cm, X seitlich mit X > 0 links, Y nach vorn zum Kopf, Z hoch, Füße bei 0).
# Jedes Bein ist als Linie Ansatz–Knie–Spitze aus BT643_fly vermessen (von oben, nur X/Y); ein Punkt gehört
# zum nächstgelegenen Bein und bewegt sich mit seinem Anteil an der Beinlänge, der Ansatz steht still.
# Dreifuß-Gang: Bein 0, 2, 3 schwingen gegen 1, 4, 5. Nach vorn schwingende Beine heben ab, die aufgesetzten
# schieben nach hinten. Walk läuft vorwärts; Turn > 0 dreht nach rechts, dann schreiten die linken Beine
# vorwärts und die rechten rückwärts. LEG_REACH ist der Ausschlag der Fußspitze nach vorn und hinten.
# Die Flügel stehen im Flug waagerecht abgespreizt (Open 0 bis 1) und zittern je Bild an eine andere Stelle
# ihres Schlagbogens (Beat), das wirkt wie das Flirren echter Fliegenflügel.
LEG_REACH = 0.9
MOTION_CODE = """
const float2 Hip[6] = { float2(-0.31, 0.39), float2(0.33, 0.48), float2(-0.34, -0.21), float2(0.35, -0.10), float2(0.35, -0.30), float2(-0.35, 0.04) };
const float2 Knee[6] = { float2(-0.87, 0.63), float2(0.74, 0.89), float2(-0.73, -0.50), float2(0.89, -0.33), float2(0.43, -1.02), float2(-1.00, 0.13) };
const float2 Tip[6] = { float2(-1.07, 1.67), float2(0.45, 1.94), float2(-1.37, -1.96), float2(1.60, -0.92), float2(0.58, -2.04), float2(-1.62, 0.23) };
const float Shift[6] = { 0.0, 3.14159265, 0.0, 0.0, 3.14159265, 3.14159265 };
float best = 1e6;
float along = 0.0;
float shift = 0.0;
float side = 1.0;
for (int i = 0; i < 6; i++)
{
    float2 a = Knee[i] - Hip[i];
    float2 b = Tip[i] - Knee[i];
    float la = length(a);
    float lb = length(b);
    float ta = saturate(dot(P.xy - Hip[i], a) / (la * la));
    float tb = saturate(dot(P.xy - Knee[i], b) / (lb * lb));
    float da = length(P.xy - Hip[i] - a * ta);
    float db = length(P.xy - Knee[i] - b * tb);
    float d = min(da, db);
    if (d < best)
    {
        best = d;
        along = (da < db ? ta * la : la + tb * lb) / (la + lb);
        shift = Shift[i];
        side = Tip[i].x > 0.0 ? 1.0 : -1.0;
    }
}
float3 q = (P - float3(0.0, -0.1, 1.0)) / float3(0.5, 1.35, 0.55);
float legs = along * saturate((0.4 - best) / 0.08) * saturate((dot(q, q) - 1.0) / 0.3) * saturate((1.0 - P.z) / 0.1);
float phase = Phase + shift;
float drive = Walk + Turn * side;
float stepping = saturate(abs(Walk) + abs(Turn));
float forward = sin(phase) * drive * REACH;
float lift = max(cos(phase) * sign(drive), 0.0) * stepping * 0.4;
float3 offset = float3(0.0, forward, lift) * legs;

float wingSide = P.x > 0.0 ? 1.0 : -1.0;
float2 hinge = float2(0.45 * wingSide, 0.22);
float3 r = (P - float3(0.0, -0.2, 0.9)) / float3(0.55, 1.45, 0.6);
float wings = saturate((P.z - 1.0) / 0.1) * saturate((0.4 - P.y) / 0.1) * saturate((dot(r, r) - 1.0) / 0.15);
float spread = Open * (1.1 + 0.7 * sin(Beat)) * wingSide;
float2 arm = P.xy - hinge;
float s = sin(spread);
float c = cos(spread);
float2 turned = float2(arm.x * c - arm.y * s, arm.x * s + arm.y * c);
offset += float3(turned - arm, Open * 0.35 * cos(Beat) * length(arm)) * wings;
return offset;
""".replace("REACH", str(LEG_REACH))


def make_fly_scan_material():
    """Material für den Scan: Farbtextur ohne den glTF-Metallwert 1, aufgehellt, mit krabbelnden Beinen.
    Fliegenweise Werte über Custom Primitive Data: 0 = Schrittphase, 1 = Laufen (0 bis 1),
    2 = Flügelschlagphase, 3 = Drehen (−1 bis 1, positiv nach rechts), 4 = Flügel offen (0 bis 1)."""
    mesh_path = f"{DEST}/Scan/SM_Fly"
    if not assets.does_asset_exist(mesh_path):
        return
    texture = next((assets.load_asset(p) for p in assets.list_assets(f"{DEST}/Scan")
                    if isinstance(assets.load_asset(p), unreal.Texture2D)), None)
    name = "M_FlyScan"
    path = f"{DEST}/{name}"
    if assets.does_asset_exist(path):
        assets.delete_asset(path)
    material = tools.create_asset(name, DEST, unreal.Material, unreal.MaterialFactoryNew())
    material.set_editor_property("two_sided", True)
    create = materials.create_material_expression
    connect = materials.connect_material_expressions

    sample = create(material, unreal.MaterialExpressionTextureSampleParameter2D, -900, -300)
    sample.set_editor_property("parameter_name", "BaseColorTexture")
    if texture:
        sample.set_editor_property("texture", texture)
    brightness = create(material, unreal.MaterialExpressionScalarParameter, -900, -100)
    brightness.set_editor_property("parameter_name", "Brightness")
    brightness.set_editor_property("default_value", 1.8)
    tint = create(material, unreal.MaterialExpressionMultiply, -600, -250)
    connect(sample, "RGB", tint, "A")
    connect(brightness, "", tint, "B")
    materials.connect_material_property(tint, "", unreal.MaterialProperty.MP_BASE_COLOR)
    for value, prop, y in ((0.0, unreal.MaterialProperty.MP_METALLIC, 0),
                           (0.55, unreal.MaterialProperty.MP_ROUGHNESS, 100),
                           (0.5, unreal.MaterialProperty.MP_SPECULAR, 200)):
        node = create(material, unreal.MaterialExpressionConstant, -600, y)
        node.set_editor_property("r", value)
        materials.connect_material_property(node, "", prop)

    world = create(material, unreal.MaterialExpressionWorldPosition, -1300, 400)
    world.set_editor_property("world_position_shader_offset", unreal.WorldPositionIncludedOffsets.WPT_EXCLUDE_ALL_SHADER_OFFSETS)
    local = create(material, unreal.MaterialExpressionTransformPosition, -1100, 400)
    local.set_editor_property("transform_source_type", unreal.MaterialPositionTransformSource.TRANSFORMPOSSOURCE_WORLD)
    local.set_editor_property("transform_type", unreal.MaterialPositionTransformSource.TRANSFORMPOSSOURCE_LOCAL)
    connect(world, "", local, "")
    params = []
    for index, label in enumerate(("Phase", "Walk", "Beat", "Turn", "Open")):
        node = create(material, unreal.MaterialExpressionScalarParameter, -1100, 550 + index * 120)
        node.set_editor_property("parameter_name", label)
        node.set_editor_property("use_custom_primitive_data", True)
        node.set_editor_property("primitive_data_index", index)
        params.append(node)
    legs = create(material, unreal.MaterialExpressionCustom, -800, 450)
    legs.set_editor_property("code", MOTION_CODE)
    legs.set_editor_property("output_type", unreal.CustomMaterialOutputType.CMOT_FLOAT3)
    legs.set_editor_property("description", "LegsAndWings")
    inputs = []
    for label in ("P", "Phase", "Walk", "Beat", "Turn", "Open"):
        entry = unreal.CustomInput()
        entry.set_editor_property("input_name", label)
        inputs.append(entry)
    legs.set_editor_property("inputs", inputs)
    connect(local, "", legs, "P")
    for param in params:
        connect(param, "", legs, str(param.get_editor_property("parameter_name")))
    to_world = create(material, unreal.MaterialExpressionTransform, -500, 450)
    to_world.set_editor_property("transform_source_type", unreal.MaterialVectorCoordTransformSource.TRANSFORMSOURCE_LOCAL)
    to_world.set_editor_property("transform_type", unreal.MaterialVectorCoordTransform.TRANSFORM_WORLD)
    connect(legs, "", to_world, "")
    unreal.FlyClockEditorLibrary.connect_world_position_offset(material, to_world)
    materials.recompile_material(material)
    assets.save_asset(path)

    # Ohne Nanite: das Netz ist klein, und die Beinbewegung braucht kein Nanite-WPO.
    mesh = assets.load_asset(mesh_path)
    settings = mesh.get_editor_property("nanite_settings")
    settings.set_editor_property("enabled", False)
    mesh.set_editor_property("nanite_settings", settings)
    mesh.set_material(0, material)
    assets.save_asset(mesh_path)
    unreal.log("FlyClock: Material des Scans angelegt")


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


GROUNDS = "/Game/Grounds"
# Helle, ruhige Untergründe, auf denen die dunklen Fliegen besser zu sehen sind als auf dem Waldboden.
# Name des Materials, Poly-Haven-Textur, Kachelgröße in Zentimetern (Scanmaß laut Poly Haven).
GROUND_VARIANTS = [
    ("M_Ground_Sand", "sand_01", 150.0),
    ("M_Ground_Grass", "leafy_grass", 200.0),
    ("M_Ground_Road", "asphalt_06", 300.0),
]


def make_ground_variants():
    for name, texture, tile in GROUND_VARIANTS:
        if not os.path.isdir(os.path.join(POLYHAVEN, "textures", texture)):
            unreal.log_warning(f"FlyClock: Textur {texture} fehlt, {name} übersprungen")
            continue
        path, material = fresh_material(name, GROUNDS)
        layer = ground_layer(material, texture, tile, 0, TEXTURE_KINDS)
        materials.connect_material_property(layer["color"], "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
        materials.connect_material_property(layer["normal"], "RGB", unreal.MaterialProperty.MP_NORMAL)
        materials.connect_material_property(layer["mask"], "R", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)
        materials.connect_material_property(layer["mask"], "G", unreal.MaterialProperty.MP_ROUGHNESS)
        materials.recompile_material(material)
        assets.save_asset(path)
        unreal.log(f"FlyClock: Untergrund {name} angelegt")


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
OXYD = os.path.normpath(os.path.join(PROJECT, "..", "..", "shared", "assets", "oxyd"))
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


def make_glass_marbles():
    """Glasmurmeln nach dem Unity-Shader "Glass Fast" aus OxydVR (GlassMarble_*.mat).

    Unity mischt die verschobene Szene mit getöntem, beleuchtetem Glas. Die Deckkraft ist ein Fresnel-Verlauf
    (1 - N·V)^0,274, in der Mitte klar, am Rand getönt; die Verschiebung kommt nur aus der Kratzer-Normal-Map
    (Stärke 2, Kachelung 2). Hier übernimmt die Pixel-Normal-Offset-Brechung von Unreal die Verschiebung.
    """
    scratches = import_texture(os.path.join(OXYD, "glass_scratches_normal.png"), f"{MARBLES}/Glass", "normal")
    path, material = fresh_material("M_GlassMarble", MARBLES)
    material.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
    material.set_editor_property("translucency_lighting_mode", unreal.TranslucencyLightingMode.TLM_SURFACE_PER_PIXEL_LIGHTING)
    refraction_mode = getattr(unreal.RefractionMode, "RM_PIXEL_NORMAL_OFFSET", None)
    if refraction_mode is not None:
        material.set_editor_property("refraction_method", refraction_mode)

    color = materials.create_material_expression(material, unreal.MaterialExpressionVectorParameter, -900, -400)
    color.set_editor_property("parameter_name", "Color")
    color.set_editor_property("default_value", unreal.LinearColor(0.283, 0.0, 0.0, 1.0))
    materials.connect_material_property(color, "", unreal.MaterialProperty.MP_BASE_COLOR)
    glow = materials.create_material_expression(material, unreal.MaterialExpressionMultiply, -600, -250)
    glow.set_editor_property("const_b", 0.335)
    materials.connect_material_expressions(color, "", glow, "A")
    materials.connect_material_property(glow, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)

    coords = materials.create_material_expression(material, unreal.MaterialExpressionTextureCoordinate, -1300, 0)
    coords.set_editor_property("u_tiling", 2.0)
    coords.set_editor_property("v_tiling", 2.0)
    sample = materials.create_material_expression(material, unreal.MaterialExpressionTextureSample, -1100, 0)
    sample.set_editor_property("texture", scratches)
    sample.set_editor_property("sampler_type", TEXTURE_KINDS["normal"])
    materials.connect_material_expressions(coords, "", sample, "UVs")
    strength = materials.create_material_expression(material, unreal.MaterialExpressionCustom, -850, 0)
    strength.set_editor_property("output_type", unreal.CustomMaterialOutputType.CMOT_FLOAT3)
    item = unreal.CustomInput()
    item.set_editor_property("input_name", "N")
    strength.set_editor_property("inputs", [item])
    strength.set_editor_property("code", "return normalize(float3(N.xy * 2.0, N.z));")
    materials.connect_material_expressions(sample, "RGB", strength, "N")
    materials.connect_material_property(strength, "", unreal.MaterialProperty.MP_NORMAL)

    # Fresnel nutzt die Pixelnormale samt Kratzern. Die Mindestdeckkraft hält die Farbe auf dem Brett erkennbar.
    fresnel = materials.create_material_expression(material, unreal.MaterialExpressionFresnel, -850, 300)
    fresnel.set_editor_property("exponent", 0.274)
    fresnel.set_editor_property("base_reflect_fraction", 0.0)
    floor = materials.create_material_expression(material, unreal.MaterialExpressionScalarParameter, -850, 450)
    floor.set_editor_property("parameter_name", "MinOpacity")
    floor.set_editor_property("default_value", 0.25)
    opacity = materials.create_material_expression(material, unreal.MaterialExpressionMax, -600, 350)
    materials.connect_material_expressions(fresnel, "", opacity, "A")
    materials.connect_material_expressions(floor, "", opacity, "B")
    materials.connect_material_property(opacity, "", unreal.MaterialProperty.MP_OPACITY)

    refraction = materials.create_material_expression(material, unreal.MaterialExpressionScalarParameter, -600, 550)
    refraction.set_editor_property("parameter_name", "Refraction")
    refraction.set_editor_property("default_value", 1.37)
    materials.connect_material_property(refraction, "", unreal.MaterialProperty.MP_REFRACTION)

    for value, prop, y in ((0.15, unreal.MaterialProperty.MP_ROUGHNESS, 700), (0.41, unreal.MaterialProperty.MP_SPECULAR, 800)):
        node = materials.create_material_expression(material, unreal.MaterialExpressionConstant, -450, y)
        node.set_editor_property("r", value)
        materials.connect_material_property(node, "", prop)
    materials.recompile_material(material)
    assets.save_asset(path)
    unreal.log("FlyClock: Glasmurmeln angelegt")


# -run=pythonscript reicht keine Argumente durch. FLYCLOCK_SETUP ist "all" oder eine Liste wie "marbles,grounds,scan,flylook,buzz".
PARTS = set(os.environ.get("FLYCLOCK_SETUP", "all").split(","))
if "all" in PARTS:
    make_material("M_Solid", False)
    make_material("M_Wing", True)
if PARTS & {"all", "buzz"}:
    make_buzz()
if PARTS & {"all", "scan"}:
    import_scan()
if PARTS & {"all", "scan", "flylook"}:
    make_fly_scan_material()
if "all" in PARTS:
    import_models()
    make_ground()
    make_sky()
if PARTS & {"all", "marbles"}:
    make_wood()
    make_marbles()
    make_glass_marbles()
if PARTS & {"all", "grounds"}:
    make_ground_variants()
unreal.log("FlyClock: Einrichtung fertig")
