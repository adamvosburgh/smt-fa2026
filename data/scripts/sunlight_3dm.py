#!/usr/bin/env python3
"""
glb_to_3dm.py - the sunlight example as a Rhino file.

Reads one of the pipeline's example GLBs and writes the same geometry as a
Rhino .3dm, so a student can open it, see the layer structure the sandbox
expects, and export it themselves as a test of the glTF exporter's naming.

  Layers:   context
            space
            space::rooms      (room_* floor patches)
            space::glazing    (glazing_* panes)
            space::walls      (wall_*, core, slab_*)
            space::surfaces   (floor_*, ceiling)
  Object names: the glTF node names (room_01, glazing_01, wall_room_01, ...).
  Units: meters. Z up. +Y north. Origin as in the GLB.

The axis change undoes the writer's Y-up transform: glTF (x, y, z) -> Rhino
(x, -z, y).

    python3 data/scripts/sunlight_3dm.py data/processed/sunlight/example-f08.glb data/processed/sunlight/example-f08.3dm   (pip install rhino3dm)
"""
import json
import struct
import sys

import numpy as np
import rhino3dm as r3


def read_glb(path):
    buf = open(path, "rb").read()
    magic, ver, total = struct.unpack_from("<III", buf, 0)
    assert magic == 0x46546C67
    jlen, jtype = struct.unpack_from("<II", buf, 12)
    js = json.loads(buf[20 : 20 + jlen].decode("utf-8"))
    blen, btype = struct.unpack_from("<II", buf, 20 + jlen)
    bin_ = buf[28 + jlen : 28 + jlen + blen]
    return js, bin_


def accessor(js, bin_, idx):
    a = js["accessors"][idx]
    bv = js["bufferViews"][a["bufferView"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    dtype = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a["componentType"]]
    n = {"VEC3": 3, "SCALAR": 1}[a["type"]]
    arr = np.frombuffer(bin_, dtype=dtype, count=a["count"] * n, offset=off)
    return arr.reshape(a["count"], n) if n > 1 else arr


def main(src, dst):
    js, bin_ = read_glb(src)
    model = r3.File3dm()
    model.Settings.ModelUnitSystem = r3.UnitSystem.Meters

    def layer(name, parent=None, color=(160, 160, 160, 255)):
        L = r3.Layer()
        L.Name = name
        L.Color = color
        if parent is not None:
            L.ParentLayerId = parent.Id
        model.Layers.Add(L)
        # Add returns an index; fetch the stored layer back to get its Id
        return model.Layers[len(model.Layers) - 1]

    l_context = layer("context", color=(150, 148, 140, 255))
    l_space = layer("space", color=(40, 40, 40, 255))
    l_rooms = layer("rooms", l_space, (230, 200, 90, 255))
    l_glazing = layer("glazing", l_space, (120, 180, 230, 255))
    l_walls = layer("walls", l_space, (200, 200, 195, 255))
    l_surfaces = layer("surfaces", l_space, (245, 245, 240, 255))

    def layer_index_for(name, in_space):
        n = name.lower()
        if not in_space:
            return l_context.Index
        if n.startswith("room_"):
            return l_rooms.Index
        if n.startswith("glazing"):
            return l_glazing.Index
        if n.startswith("wall") or n.startswith("core") or n.startswith("slab") or n.startswith("partition"):
            return l_walls.Index
        return l_surfaces.Index

    # walk the scene: root nodes -> children
    nodes = js["nodes"]
    count = 0
    for root_idx in js["scenes"][0]["nodes"]:
        root = nodes[root_idx]
        in_space = root["name"].lower().startswith("space")
        for ci in root.get("children", []):
            node = nodes[ci]
            if "mesh" not in node:
                continue
            mesh = js["meshes"][node["mesh"]]
            m = r3.Mesh()
            for prim in mesh["primitives"]:
                pos = accessor(js, bin_, prim["attributes"]["POSITION"])
                idx = accessor(js, bin_, prim["indices"])
                base = len(m.Vertices)
                for x, y, z in pos:
                    m.Vertices.Add(float(x), float(-z), float(y))  # glTF Y-up -> Rhino Z-up
                for t in range(0, len(idx), 3):
                    m.Faces.AddFace(base + int(idx[t]), base + int(idx[t + 1]), base + int(idx[t + 2]))
            m.Normals.ComputeNormals()
            m.Compact()
            attr = r3.ObjectAttributes()
            attr.Name = node["name"]
            attr.LayerIndex = layer_index_for(node["name"], in_space)
            model.Objects.AddMesh(m, attr)
            count += 1
    # rhino3dm 8.x exposes neither Notes nor a string setter, so the site
    # metadata is put on a text dot at the origin instead, where it is seen.
    site = js["asset"].get("extras", {}).get("site", {})
    dot = r3.TextDot(f"origin: {site.get('latitude')}, {site.get('longitude')}; +Y = north; meters", r3.Point3d(0, 0, 0))
    attr = r3.ObjectAttributes()
    attr.Name = "site"
    attr.LayerIndex = l_space.Index
    model.Objects.AddTextDot(dot.Text, dot.Point, attr) if hasattr(model.Objects, "AddTextDot") else model.Objects.Add(dot, attr)
    ok = model.Write(dst, 8)
    print(f"{dst}: {count} meshes, {len(model.Layers)} layers, written={ok}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
