"""Import Vesper's generated GLBs into a new editable Blender scene.

Run with Blender 4.2+ (not ordinary Python):
  blender --background --python vesper/import_into_blender.py -- --asset both

Also usable from Blender's Scripting workspace. No existing scene is deleted.
The script is supplied as an editing handoff; it has not been run in Blender in
the development environment, where Blender is not installed.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=("character", "church", "both"), default="both")
    parser.add_argument("--assets-dir", type=Path, help="Folder containing nailong.glb and church.glb")
    parser.add_argument("--output", type=Path, help="Destination .blend file")
    parser.add_argument("--engine", choices=("eevee", "cycles"), default="eevee")
    parser.add_argument("--samples", type=int, default=64, help="Cycles samples, if selected")
    parser.add_argument("--render", type=Path, help="Optional still image destination (.png)")
    parser.add_argument("--camera", choices=("nave", "gallery", "study"))
    parser.add_argument("--frame", type=int, default=1)
    parser.add_argument("--overwrite", action="store_true", help="Allow replacing the requested output files")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    result = parser.parse_args(argv)
    script_file = globals().get("__file__")
    if script_file:
        script_directory = Path(script_file).resolve().parent
    elif bpy.context.space_data and getattr(bpy.context.space_data, "text", None):
        text_file = bpy.context.space_data.text.filepath
        if not text_file:
            parser.error("Save this text as import_into_blender.py, or run the saved file with --python.")
        script_directory = Path(bpy.path.abspath(text_file)).resolve().parent
    else:
        parser.error("A saved script filepath is needed to locate the GLB assets.")
    result.assets_dir = (result.assets_dir or script_directory / "assets").resolve()
    result.output = (result.output or result.assets_dir / f"vesper-{result.asset}.blend").resolve()
    if result.output.suffix.lower() != ".blend":
        parser.error("--output must end in .blend")
    if result.render:
        result.render = result.render.resolve()
        if result.render.suffix.lower() != ".png":
            parser.error("--render must end in .png")
    if not 1 <= result.samples <= 4096:
        parser.error("--samples must be between 1 and 4096")
    for output in [result.output, result.render]:
        if output and output.exists() and not result.overwrite:
            parser.error(f"Output already exists: {output}. Choose another path or use --overwrite.")
    required = []
    if result.asset in ("church", "both"):
        required.append(result.assets_dir / "church.glb")
    if result.asset in ("character", "both"):
        required.append(result.assets_dir / "nailong.glb")
    for source in required:
        if not source.is_file():
            parser.error(f"Missing exported asset: {source}")
    return result


def make_collection(scene, name):
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    return collection


def import_glb(path):
    objects_before = set(bpy.data.objects)
    actions_before = set(bpy.data.actions)
    # Blender's importer converts glTF X,Y,Z to Blender X,-Z,Y. Do not rotate
    # the imported hierarchy a second time or apply its transforms to the skin.
    bpy.ops.import_scene.gltf(filepath=str(path), import_pack_images=True, merge_vertices=False)
    imported = set(bpy.data.objects) - objects_before
    for action in set(bpy.data.actions) - actions_before:
        action.use_fake_user = True
    return imported


def place_character(objects, collection, in_church):
    placement = bpy.data.objects.new("Nailong placement — edit this transform", None)
    collection.objects.link(placement)
    placement.empty_display_type = "PLAIN_AXES"
    placement.empty_display_size = 0.35
    # Reparent only the GLB's top-level nodes; retain the imported bone and mesh
    # transforms, animation relationships and any importer-generated root.
    for obj in objects:
        if obj.parent not in objects:
            world_matrix = obj.matrix_world.copy()
            obj.parent = placement
            obj.matrix_world = world_matrix
    if in_church:
        placement.location = (0.0, -10.0, 0.0)
        placement.rotation_euler.z = math.pi
    placement["source_front"] = "glTF +Z / Blender -Y"
    placement["placement_note"] = "In the nave, rotated to face the altar at Blender +Y."
    return placement


def camera(collection, name, location, target, lens):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_start = 0.05
    data.clip_end = 150.0
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def area_light(collection, name, location, target, color, energy, size):
    data = bpy.data.lights.new(name, "AREA")
    data.color = color
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def studio(collection):
    # Presentation-only lighting for the isolated character. Church imports use
    # their authored punctual lights and a low-energy world fill instead.
    area_light(collection, "Study key", (-3, -4, 5), (0, 0, 0.8), (1.0, 0.86, 0.66), 400, 4)
    area_light(collection, "Study rim", (3, 2, 3.5), (0, 0, 0.9), (0.62, 0.68, 1.0), 280, 3)
    area_light(collection, "Study fill", (3, -3, 2.0), (0, 0, 0.8), (0.79, 0.82, 1.0), 80, 4)
    mesh = bpy.data.meshes.new("Study floor mesh")
    mesh.from_pydata([(-4, -4, -0.006), (4, -4, -0.006), (4, 4, -0.006), (-4, 4, -0.006)], [], [(0, 1, 2, 3)])
    mesh.update()
    obj = bpy.data.objects.new("Study floor", mesh)
    collection.objects.link(obj)
    material = bpy.data.materials.new("Study floor · plum gray")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.07, 0.055, 0.09, 1)
    shader.inputs["Roughness"].default_value = 0.86
    mesh.materials.append(material)


def configure_scene(scene, options):
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    if options.engine == "cycles":
        if "CYCLES" not in engines:
            raise RuntimeError("Cycles is unavailable in this Blender installation; use --engine eevee.")
        scene.render.engine = "CYCLES"
        scene.cycles.samples = options.samples
        scene.cycles.use_denoising = True
    else:
        engine = next((name for name in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE") if name in engines), None)
        if engine is None:
            raise RuntimeError("Eevee is unavailable in this Blender installation; use --engine cycles.")
        scene.render.engine = engine
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.fps = 24
    scene.frame_start = 1
    scene.frame_end = 72
    transforms = {item.identifier for item in scene.view_settings.bl_rna.properties["view_transform"].enum_items}
    if "AgX" in transforms:
        scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    world = bpy.data.worlds.new("Vesper · cold violet ambient")
    world.use_nodes = True
    scene.world = world
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.14, 0.105, 0.20, 1)
    background.inputs["Strength"].default_value = 0.14 if options.asset == "character" else 0.07
    scene["asset_source"] = "Procedural Three.js models exported as GLB; imported for Blender editing."
    scene["coordinate_mapping"] = "glTF X,Y,Z -> Blender X,-Z,Y; one metre per unit."
    scene["browser_effects"] = "Three.js fog, post-processing and animated dust are not portable GLB effects."


def main():
    options = arguments()
    # A new scene keeps existing work in an interactive Blender session intact.
    scene = bpy.data.scenes.new("Vesper · editable assets")
    if bpy.context.window is None:
        raise RuntimeError("A Blender window context is required (available in normal --background mode).")
    bpy.context.window.scene = scene
    configure_scene(scene, options)
    presentation = make_collection(scene, "Vesper · cameras and presentation")
    imported = set()
    actions_before = set(bpy.data.actions)
    if options.asset in ("church", "both"):
        imported |= import_glb(options.assets_dir / "church.glb")
    if options.asset in ("character", "both"):
        if any(obj.name == "Nailong" or obj.name.startswith("Nailong.") for obj in imported):
            raise RuntimeError("church.glb already contains Nailong. Export a church-only GLB to avoid a duplicate character.")
        character_objects = import_glb(options.assets_dir / "nailong.glb")
        place_character(character_objects, presentation, options.asset == "both")
        imported |= character_objects
    if options.asset == "character":
        studio(presentation)
    elif not any(obj.type == "LIGHT" for obj in imported):
        # Fallback applies only when the supplied church GLB lacks lights.
        area_light(presentation, "Fallback window daylight", (8.5, 8, 9), (0, 15.2, 6.7), (0.74, 0.74, 1.0), 900, 4)
    study_center = (0, -10, 0.85) if options.asset == "both" else (0, 0, 0.85)
    study_camera = (3, -15.3, 2.1) if options.asset == "both" else (3, -5.3, 2.1)
    cameras = {
        "nave": camera(presentation, "Camera · nave", (0, -13.6, 3.25), (0, 9.5, 5.25), 24),
        "gallery": camera(presentation, "Camera · gallery", (0, -11.5, 8.1), (0, 10, 5.3), 27),
        "study": camera(presentation, "Camera · character study", study_camera, study_center, 48),
    }
    scene.camera = cameras[options.camera or ("study" if options.asset == "character" else "nave")]
    imported_actions = set(bpy.data.actions) - actions_before
    if imported_actions:
        scene.frame_end = max(2, math.ceil(max(action.frame_range[1] for action in imported_actions)))
    scene.frame_set(options.frame)
    for obj in imported:
        obj.select_set(False)
    scene.camera.select_set(True)
    bpy.context.view_layer.objects.active = scene.camera
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
    options.output.parent.mkdir(parents=True, exist_ok=True)
    if options.render:
        options.render.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(options.render)
    bpy.ops.wm.save_as_mainfile(filepath=str(options.output), check_existing=False)
    print(f"Vesper: saved {options.output} ({len(imported)} imported objects)")
    if options.render:
        bpy.ops.render.render(write_still=True)
        print(f"Vesper: rendered {options.render}")


if __name__ == "__main__":
    main()
