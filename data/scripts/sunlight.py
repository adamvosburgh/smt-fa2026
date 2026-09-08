#!/usr/bin/env python3
"""
sunlight.py - pipeline for the sunlight sandbox's example model.

WHAT IT WRITES
--------------
data/processed/sunlight/
  example-f03.glb, example-f08.glb, example-f15.glb
      One glTF binary per example floor. Each carries the same context and a
      different floor of the same building as the analyzed space. These are the
      files the sandbox loads by default, the files the tutorial links for
      download, and the reference a student preps their own model against.
  manifest.json
      Site, origin, floor heights, every geometric assumption, the room table
      (so the browser's areas can be checked against the pipeline's), counts,
      and provenance.

THE SUBJECT
-----------
25 Water Street, Manhattan (formerly 4 New York Plaza; MapPLUTO lists the lot,
Block 5 Lot 10, as 115 Broad Street). Carson, Lundin & Shaw, completed 1969,
22 stories, about 1.1M sf; from 2023 converted to about 1,300 apartments with
ten stories added and two courtyards cut into the plate. The 2014 city survey
used here shows the 22-story office building as it stood before conversion,
so the example is the plate the conversion had to deal with.

  BIN 1000007. Verified 2026-09-06 three ways: the DCP CityGML ground surface
  containing the MapPLUTO lot centroid; NYC Building Footprints row bin 1000007
  -> base_bbl 1000050010; MapPLUTO 26v2 record for BBL 1000050010: 115 BROAD
  STREET, YearBuilt 1969, NumFloors 32, UnitsRes 1,320, ResArea 995,416.
  Footprint 3,775 m2 (40,636 sf) from the survey; PLUTO BldgFront 148 ft x
  BldgDepth 276 ft.

INPUTS  (data/original/, as downloaded, never edited in place)
--------------------------------------------------------------
  DA_WISE_GML/DA_WISE_GMLs/DA12_3D_Buildings_Merged.gml
      DCP 3-D Building Model, CityGML 2.0, NYC Open Data tnru-abg2. EPSG:2263,
      US survey feet, LoD2, 2014 aerial survey. TAKEN per building within
      CONTEXT_RADIUS_FT of the subject: BIN, every GroundSurface ring with its
      elevation, every RoofSurface ring with its elevation. Wall surfaces are
      counted and discarded; the massing is rebuilt as one prism per roof
      polygon, from that building's ground elevation to the roof's, which is
      how a stacked LoD2 massing is normally reconstructed. Interior rings
      (courtyards) are not distinguished from exterior ones: DA12 has six in
      the whole file, none near the subject.
      DA19, DA11 and DA13 were scanned with the same box and hold nothing in
      it. Brooklyn and Governors Island are outside the box; the nearest
      Brooklyn waterfront is about 1 km away across the East River.

NOTHING ELSE IS READ. The lat/lon of the origin is computed here with the
EPSG:2263 inverse projection (Lambert conformal conic, GRS80, standard parallels
40deg40' and 41deg02', origin 40deg10' / -74deg, false easting 300,000 m),
checked against pyproj's output in data/processed/after-five/footprints.json to
six decimals on 2026-09-06.

COORDINATES IN THE FILE
-----------------------
Local meters. Origin: the vertex-mean center of the subject's ground ring, at
the subject's ground elevation. Model axes before export: +X east, +Y north,
+Z up (a Rhino model, top view). glTF is Y-up, so the writer applies the same
transform Rhino's exporter applies with "Map Rhino Z to glTF Y":
    (x, y, z) -> (x, z, -y)
which means: in the file, +X is east, +Y is up, -Z is north.

THE TAGGING CONVENTION (what the sandbox reads)
-----------------------------------------------
Node names, matched by prefix, case-insensitive. The same words work as mesh or
material names, which is what makes the convention survive exporters that
rename nodes.
  context*          opaque, casts and receives shadows, gray, not analyzed
  space             a group; everything under it is the analyzed space
    room_<id>       a planar floor patch; analyzed; one row in the room table
    floor*          analyzed floor surface that belongs to no room
    ceiling*        analyzed
    wall*, core*, partition*
                    opaque, casts and receives shadows, analyzed
    slab*           opaque, casts and receives shadows, NOT analyzed (its faces
                    sit 1 cm under the floor and ceiling surfaces, which are)
    glazing_<id>    transparent to the sun, drawn translucent, not analyzed;
                    <id> matching a room's ties the pane to that room
  context_above*    context the cut-away view hides from the camera (the
                    stories above the analyzed floor); it still casts shadows
  anything else     treated as context, and reported as untagged

FLOOR CONVENTION FOR THE EXAMPLE
--------------------------------
22 stories divided evenly into the surveyed main-roof height of 86.0 m
(282.1 ft) gives 3.908 m (12.8 ft) floor to floor. That is an assumption:
the survey knows the roof, not the floors. Floor n occupies
[(n-1)h, nh]. Slabs 0.30 m. Glazing band sill 0.90 m, head 2.40 m above the
finished floor, continuous around the perimeter. Bays 9.14 m (30 ft) deep,
about 7.5 m (25 ft) wide, with a mitred corner bay at each corner. Corridor
and core: a 30 m x 12 m core centered on the plate. Everything in this
paragraph is ours and is repeated in manifest.json under "assumptions".

The plate is the survey's outline simplified to its four principal corners.
The surveyed outline has jogs of up to 4 m at the two short ends (2 m either
side of the straight line); the context parts of the same building - the
stories below and above the analyzed floor - keep the surveyed outline.

RUN
---
    python3 data/scripts/sunlight.py            # from the repo root
No dependencies beyond the standard library and numpy.
"""

import json
import math
import re
import struct
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from _common import original_dir  # noqa: E402

# ----------------------------------------------------------------------------
# Constants: the subject and the assumptions. All of these go into the manifest.
# ----------------------------------------------------------------------------
SUBJECT_BIN = "1000007"
GML_FILE = "DA_WISE_GML/DA_WISE_GMLs/DA12_3D_Buildings_Merged.gml"
CONTEXT_RADIUS_FT = 3000.0          # half-width of the square box, in survey feet
US_FT = 0.3048006096                # US survey foot in meters (EPSG:2263 unit)

STORIES = 22                        # 25 Water Street before conversion
MAIN_ROOF_M = None                  # read from the survey: the largest roof polygon
EXAMPLE_FLOORS = [3, 8, 15]         # which stories become the analyzed space
SLAB_M = 0.30
SILL_M = 0.90
HEAD_M = 2.40
BAY_DEPTH_M = 9.144                 # 30 ft
BAY_WIDTH_TARGET_M = 7.62           # 25 ft
CORE_M = (30.0, 12.0)               # long x short, centered on the plate
SURFACE_LIFT_M = 0.01               # analysis surfaces float this far off slabs
GROUND_HALF_M = 900.0               # the ground plane's half-size

VAL = re.compile(r"<gen:value>([^<]*)</gen:value>")
POS = re.compile(r"<gml:posList>([^<]*)</gml:posList>")


# ----------------------------------------------------------------------------
# 1. Read the CityGML around the subject
# ----------------------------------------------------------------------------
def read_gml_box(path, cx, cy, half):
    """Buildings whose first surface vertex falls in the box. Streamed."""
    x0, x1, y0, y1 = cx - half, cx + half, cy - half, cy + half
    out, seen = {}, 0
    cur = want = surface = skip = None
    rec = None
    with open(path, "r", errors="replace") as f:
        for line in f:
            if "<bldg:Building " in line or "<bldg:Building>" in line:
                if rec is not None and not skip and cur:
                    out[cur] = rec
                cur, want, surface, skip, rec = None, False, None, False, None
                seen += 1
                continue
            if cur is None:
                if want:
                    m = VAL.search(line)
                    if m:
                        cur = m.group(1).strip()
                        want = False
                        rec = {"ground": [], "roofs": [], "walls": 0}
                elif 'name="BIN"' in line:
                    want = True
                continue
            if skip:
                continue
            if "<bldg:GroundSurface" in line:
                surface = "ground"
            elif "<bldg:RoofSurface" in line:
                surface = "roofs"
            elif "<bldg:WallSurface" in line:
                surface = "walls"
            elif surface:
                m = POS.search(line)
                if not m:
                    continue
                p = m.group(1).split()
                if len(p) < 12:
                    continue
                xs = [float(v) for v in p[0::3]]
                ys = [float(v) for v in p[1::3]]
                zs = [float(v) for v in p[2::3]]
                if not (x0 <= xs[0] <= x1 and y0 <= ys[0] <= y1):
                    skip = True
                    continue
                if surface == "walls":
                    rec["walls"] += 1
                    continue
                rec[surface].append((xs, ys, sum(zs) / len(zs)))
    if rec is not None and not skip and cur:
        out[cur] = rec
    return out, seen


def find_subject_centre(path):
    """First pass: the subject's ground ring center, so the box can be placed.
    Reads until the subject is found, then stops."""
    cur = want = surface = None
    with open(path, "r", errors="replace") as f:
        for line in f:
            if "<bldg:Building " in line or "<bldg:Building>" in line:
                cur, want, surface = None, False, None
                continue
            if cur is None:
                if want:
                    m = VAL.search(line)
                    if m:
                        cur = m.group(1).strip()
                        want = False
                elif 'name="BIN"' in line:
                    want = True
                continue
            if cur != SUBJECT_BIN:
                continue
            if "<bldg:GroundSurface" in line:
                surface = "ground"
            elif "<bldg:RoofSurface" in line or "<bldg:WallSurface" in line:
                surface = None
            elif surface == "ground":
                m = POS.search(line)
                if m:
                    p = m.group(1).split()
                    xs = [float(v) for v in p[0::3]]
                    ys = [float(v) for v in p[1::3]]
                    zs = [float(v) for v in p[2::3]]
                    if xs[0] == xs[-1] and ys[0] == ys[-1]:
                        xs, ys = xs[:-1], ys[:-1]
                    return sum(xs) / len(xs), sum(ys) / len(ys), sum(zs) / len(zs)
    raise SystemExit(f"subject BIN {SUBJECT_BIN} not found in {path.name}")


# ----------------------------------------------------------------------------
# 2. Projection: EPSG:2263 (ftUS) -> WGS84, for the manifest only
# ----------------------------------------------------------------------------
def lcc_inverse(E, N):
    a = 6378137.0
    f = 1 / 298.257222101
    e = math.sqrt(2 * f - f * f)
    lat1 = math.radians(40 + 40 / 60)
    lat2 = math.radians(41 + 2 / 60)
    lat0 = math.radians(40 + 10 / 60)
    lon0 = math.radians(-74.0)
    FE = 300000.0 / US_FT

    def m(l):
        return math.cos(l) / math.sqrt(1 - e * e * math.sin(l) ** 2)

    def t(l):
        return math.tan(math.pi / 4 - l / 2) / ((1 - e * math.sin(l)) / (1 + e * math.sin(l))) ** (e / 2)

    n = (math.log(m(lat1)) - math.log(m(lat2))) / (math.log(t(lat1)) - math.log(t(lat2)))
    F = m(lat1) / (n * t(lat1) ** n)
    r0 = a * F * t(lat0) ** n
    x = (E - FE) * US_FT
    y = N * US_FT
    r = math.copysign(math.hypot(x, r0 - y), n)
    tt = (r / (a * F)) ** (1 / n)
    theta = math.atan2(x, r0 - y)
    lon = theta / n + lon0
    lat = math.pi / 2 - 2 * math.atan(tt)
    for _ in range(12):
        lat = math.pi / 2 - 2 * math.atan(tt * ((1 - e * math.sin(lat)) / (1 + e * math.sin(lat))) ** (e / 2))
    return math.degrees(lon), math.degrees(lat)


# ----------------------------------------------------------------------------
# 3. Geometry helpers: rings, triangulation, prisms, quads
# ----------------------------------------------------------------------------
def signed_area(ring):
    a = 0.0
    n = len(ring)
    for i in range(n):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % n]
        a += x0 * y1 - x1 * y0
    return a * 0.5


def clean_ring(ring):
    """Drop a closing duplicate and consecutive duplicates; make it CCW."""
    out = []
    for p in ring:
        if not out or (abs(p[0] - out[-1][0]) > 1e-6 or abs(p[1] - out[-1][1]) > 1e-6):
            out.append(p)
    if len(out) > 1 and abs(out[0][0] - out[-1][0]) < 1e-6 and abs(out[0][1] - out[-1][1]) < 1e-6:
        out.pop()
    if len(out) >= 3 and signed_area(out) < 0:
        out.reverse()
    return out


def triangulate(ring):
    """Ear clipping on a CCW simple polygon. Falls back to a fan if it stalls
    (a self-touching survey polygon), which is wrong in a small way rather
    than failing."""
    n = len(ring)
    if n < 3:
        return []
    if n == 3:
        return [(0, 1, 2)]
    idx = list(range(n))
    tris = []

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def inside(p, a, b, c):
        return cross(a, b, p) >= -1e-9 and cross(b, c, p) >= -1e-9 and cross(c, a, p) >= -1e-9

    guard = 0
    while len(idx) > 3 and guard < 10000:
        guard += 1
        found = False
        m = len(idx)
        for k in range(m):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % m]
            a, b, c = ring[i0], ring[i1], ring[i2]
            if cross(a, b, c) <= 1e-9:
                continue  # reflex or degenerate
            ok = True
            for j in idx:
                if j in (i0, i1, i2):
                    continue
                if inside(ring[j], a, b, c):
                    ok = False
                    break
            if ok:
                tris.append((i0, i1, i2))
                idx.pop(k)
                found = True
                break
        if not found:
            break
    if len(idx) == 3:
        tris.append(tuple(idx))
    elif len(idx) > 3:
        # fallback fan
        for k in range(1, len(idx) - 1):
            tris.append((idx[0], idx[k], idx[k + 1]))
    return tris


class MeshBuilder:
    """Accumulates one indexed triangle mesh: positions (x, y, z) in model
    space (Z-up), uint32 indices. Vertices are shared only within a face, so
    flat shading in the viewer is exact."""

    def __init__(self):
        self.pos = []
        self.idx = []

    def face(self, pts3):
        """A planar polygon given as 3D points (CCW seen from the side its
        normal faces)."""
        base = len(self.pos)
        self.pos.extend(pts3)
        ring2 = _project(pts3)
        for a, b, c in triangulate(ring2):
            self.idx.extend((base + a, base + b, base + c))

    def quad(self, a, b, c, d):
        base = len(self.pos)
        self.pos.extend((a, b, c, d))
        self.idx.extend((base, base + 1, base + 2, base, base + 2, base + 3))

    def prism(self, ring, z0, z1, top=True, bottom=False):
        """A ring (CCW in plan) extruded from z0 to z1. Sides face outward."""
        n = len(ring)
        for i in range(n):
            x0, y0 = ring[i]
            x1, y1 = ring[(i + 1) % n]
            self.quad((x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y0, z1))
        if top:
            self.face([(x, y, z1) for x, y in ring])
        if bottom:
            self.face([(x, y, z0) for x, y in reversed(ring)])

    def empty(self):
        return not self.idx


def _project(pts3):
    """Drop the axis the polygon is flattest in, keeping orientation so that a
    CCW-from-normal polygon stays CCW for the ear clipper."""
    p = np.asarray(pts3, dtype=float)
    # normal by Newell
    nrm = np.zeros(3)
    for i in range(len(p)):
        a, b = p[i], p[(i + 1) % len(p)]
        nrm += np.cross(a, b)
    ax = int(np.argmax(np.abs(nrm)))
    keep = [i for i in range(3) if i != ax]
    ring = [(float(q[keep[0]]), float(q[keep[1]])) for q in p]
    if nrm[ax] < 0:
        ring = [(v, u) for u, v in ring]
    if signed_area(ring) < 0:
        ring = [(v, u) for u, v in ring]
    return ring


# ----------------------------------------------------------------------------
# 4. The plate: four principal corners, bays, core
# ----------------------------------------------------------------------------
def douglas_peucker_ring(points, tol):
    def seg(pts_):
        if len(pts_) < 3:
            return pts_
        (x0, y0), (x1, y1) = pts_[0], pts_[-1]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1e-9
        dmax, idx = 0.0, 0
        for i in range(1, len(pts_) - 1):
            d = abs(dy * pts_[i][0] - dx * pts_[i][1] + x1 * y0 - y1 * x0) / L
            if d > dmax:
                dmax, idx = d, i
        if dmax > tol:
            return seg(pts_[: idx + 1])[:-1] + seg(pts_[idx:])
        return [pts_[0], pts_[-1]]

    n = len(points)
    i1 = max(range(n), key=lambda i: math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]))
    a = seg(points[0 : i1 + 1])
    b = seg(points[i1:] + [points[0]])
    return a[:-1] + b[:-1]


def principal_quad(ring):
    """The plate as a rectangle: the surveyed outline is a rectangle with jogs
    at its short ends, so rotate it onto the axis of its longest edge, sort the
    edges into four sides by direction and position, take each side's
    length-weighted mean coordinate, and intersect. Returns the quad (CCW, in
    the original frame), the simplified outline, and the largest distance from
    a surveyed vertex to the quad's boundary."""
    s = douglas_peucker_ring(ring, 1.5)
    n = len(s)
    lens = [math.hypot(s[(i + 1) % n][0] - s[i][0], s[(i + 1) % n][1] - s[i][1]) for i in range(n)]
    k = int(np.argmax(lens))
    ang = math.atan2(s[(k + 1) % n][1] - s[k][1], s[(k + 1) % n][0] - s[k][0])
    ca, sa = math.cos(-ang), math.sin(-ang)

    def rot(p):
        return (p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca)

    def unrot(p):
        return (p[0] * math.cos(ang) - p[1] * math.sin(ang), p[0] * math.sin(ang) + p[1] * math.cos(ang))

    r = [rot(p) for p in s]
    cu = sum(p[0] for p in r) / n
    cv = sum(p[1] for p in r) / n
    acc = {"left": [0.0, 0.0], "right": [0.0, 0.0], "bottom": [0.0, 0.0], "top": [0.0, 0.0]}
    for i in range(n):
        a, b = r[i], r[(i + 1) % n]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        mu, mv = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        if abs(b[0] - a[0]) >= abs(b[1] - a[1]):
            side = "top" if mv > cv else "bottom"
            acc[side][0] += mv * L
        else:
            side = "right" if mu > cu else "left"
            acc[side][0] += mu * L
        acc[side][1] += L
    left = acc["left"][0] / acc["left"][1]
    right = acc["right"][0] / acc["right"][1]
    bottom = acc["bottom"][0] / acc["bottom"][1]
    top = acc["top"][0] / acc["top"][1]
    quad = [unrot(p) for p in [(left, bottom), (right, bottom), (right, top), (left, top)]]
    if signed_area(quad) < 0:
        quad.reverse()
    # deviation of the surveyed vertices from the rectangle's boundary
    dev = 0.0
    for p in ring:
        u, v = rot(p)
        d = min(abs(u - left), abs(u - right), abs(v - bottom), abs(v - top))
        dev = max(dev, d)
    return quad, s, dev


def inward_offset(quad, d):
    """Mitred inward offset of a convex CCW polygon."""
    n = len(quad)
    lines = []
    for i in range(n):
        (x0, y0), (x1, y1) = quad[i], quad[(i + 1) % n]
        L = math.hypot(x1 - x0, y1 - y0)
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L  # inward normal for CCW
        lines.append(((x0 + nx * d, y0 + ny * d), (x1 + nx * d, y1 + ny * d)))
    out = []
    for i in range(n):
        (a, b), (c, e) = lines[i - 1], lines[i]
        out.append(_intersect(a, b, c, e))
    return out


def _intersect(p1, p2, p3, p4):
    x1, y1 = p1
    x2, y2 = p2
    x3, y3 = p3
    x4, y4 = p4
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def poly_area(ring):
    return abs(signed_area(ring))


def build_bays(quad, inner, width_target):
    """Bays along each edge: the band between the outline edge and the offset
    edge, cut at equal fractions of both. Corner bays are trapezoids with the
    mitre as their inner corner. Returns [(name, outer_a, outer_b, inner_b,
    inner_a, edge_index)] in CCW order."""
    bays = []
    n = len(quad)
    k = 0
    for i in range(n):
        A, B = quad[i], quad[(i + 1) % n]
        a, b = inner[i], inner[(i + 1) % n]
        L = math.hypot(B[0] - A[0], B[1] - A[1])
        count = max(1, round(L / width_target))
        for j in range(count):
            t0, t1 = j / count, (j + 1) / count
            k += 1
            bays.append((f"{k:02d}", lerp(A, B, t0), lerp(A, B, t1), lerp(a, b, t1), lerp(a, b, t0), i))
    return bays


def core_rect(quad, size):
    """A rectangle of `size` (long, short) centered on the plate's centroid and
    aligned with its longest edge."""
    n = len(quad)
    lens = [math.hypot(quad[(i + 1) % n][0] - quad[i][0], quad[(i + 1) % n][1] - quad[i][1]) for i in range(n)]
    i = int(np.argmax(lens))
    ang = math.atan2(quad[(i + 1) % n][1] - quad[i][1], quad[(i + 1) % n][0] - quad[i][0])
    cx = sum(p[0] for p in quad) / n
    cy = sum(p[1] for p in quad) / n
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    L, W = size[0] / 2, size[1] / 2
    rect = [
        (cx - ux * L - vx * W, cy - uy * L - vy * W),
        (cx + ux * L - vx * W, cy + uy * L - vy * W),
        (cx + ux * L + vx * W, cy + uy * L + vy * W),
        (cx - ux * L + vx * W, cy - uy * L + vy * W),
    ]
    if signed_area(rect) < 0:
        rect.reverse()
    return rect, math.degrees(ang)


def match_sides(inner, core):
    """Rotate the core's vertex order so side i of the core faces side i of
    the inner quad (nearest edge midpoints)."""
    def mids(q):
        return [lerp(q[i], q[(i + 1) % 4], 0.5) for i in range(4)]
    mi = mids(inner)
    best, bestd = 0, 1e18
    for shift in range(4):
        c = core[shift:] + core[:shift]
        mc = mids(c)
        d = sum(math.hypot(mi[i][0] - mc[i][0], mi[i][1] - mc[i][1]) for i in range(4))
        if d < bestd:
            best, bestd = shift, d
    return core[best:] + core[:best]


# ----------------------------------------------------------------------------
# 5. glTF binary writer
# ----------------------------------------------------------------------------
def to_gltf_axes(p):
    x, y, z = p
    return (x, z, -y)


class GLB:
    def __init__(self):
        self.bin = bytearray()
        self.buffer_views = []
        self.accessors = []
        self.meshes = []
        self.nodes = []
        self.materials = []
        self.mat_index = {}

    def material(self, name, rgba, metallic=0.0, roughness=0.9, blend=False, double=True):
        if name in self.mat_index:
            return self.mat_index[name]
        m = {
            "name": name,
            "pbrMetallicRoughness": {"baseColorFactor": list(rgba), "metallicFactor": metallic, "roughnessFactor": roughness},
            "doubleSided": double,
        }
        if blend:
            m["alphaMode"] = "BLEND"
        self.materials.append(m)
        self.mat_index[name] = len(self.materials) - 1
        return self.mat_index[name]

    def _view(self, data, target):
        while len(self.bin) % 4:
            self.bin += b"\x00"
        off = len(self.bin)
        self.bin += data
        self.buffer_views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data), "target": target})
        return len(self.buffer_views) - 1

    def mesh(self, name, builder, material):
        pos = np.array([to_gltf_axes(p) for p in builder.pos], dtype=np.float32)
        idx = np.array(builder.idx, dtype=np.uint32)
        pv = self._view(pos.tobytes(), 34962)
        iv = self._view(idx.tobytes(), 34963)
        self.accessors.append({
            "bufferView": pv, "componentType": 5126, "count": len(pos), "type": "VEC3",
            "min": [float(v) for v in pos.min(axis=0)], "max": [float(v) for v in pos.max(axis=0)],
        })
        pa = len(self.accessors) - 1
        self.accessors.append({"bufferView": iv, "componentType": 5125, "count": len(idx), "type": "SCALAR"})
        ia = len(self.accessors) - 1
        self.meshes.append({"name": name, "primitives": [{"attributes": {"POSITION": pa}, "indices": ia, "material": material, "mode": 4}]})
        return len(self.meshes) - 1

    def node(self, name, mesh=None, children=None, extras=None):
        n = {"name": name}
        if mesh is not None:
            n["mesh"] = mesh
        if children:
            n["children"] = children
        if extras:
            n["extras"] = extras
        self.nodes.append(n)
        return len(self.nodes) - 1

    def write(self, path, roots, extras):
        gltf = {
            "asset": {"version": "2.0", "generator": "smt-fa2026 data/scripts/sunlight.py", "extras": extras},
            "scene": 0,
            "scenes": [{"nodes": roots}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.buffer_views,
            "buffers": [{"byteLength": len(self.bin)}],
        }
        js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        while len(js) % 4:
            js += b" "
        while len(self.bin) % 4:
            self.bin += b"\x00"
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(js), 0x4E4F534A))
            f.write(js)
            f.write(struct.pack("<II", len(self.bin), 0x004E4942))
            f.write(self.bin)
        return total


# ----------------------------------------------------------------------------
# 6. Main
# ----------------------------------------------------------------------------
def main():
    original = original_dir()
    gml = original / GML_FILE
    out = Path(__file__).resolve().parents[1] / "processed" / "sunlight"
    out.mkdir(parents=True, exist_ok=True)

    print(f"gml: locating subject BIN {SUBJECT_BIN}")
    cx, cy, cz = find_subject_centre(gml)
    lon, lat = lcc_inverse(cx, cy)
    print(f"gml: subject ring center {cx:.2f}, {cy:.2f} ft (EPSG:2263) -> {lon:.6f}, {lat:.6f}; ground {cz:.2f} ft")

    raw, seen = read_gml_box(gml, cx, cy, CONTEXT_RADIUS_FT)
    print(f"gml: {seen:,} buildings scanned, {len(raw):,} in the {2 * CONTEXT_RADIUS_FT:.0f} ft box")
    if SUBJECT_BIN not in raw:
        raise SystemExit("subject not in box")

    def local(x, y):
        return ((x - cx) * US_FT, (y - cy) * US_FT)

    def local_z(z):
        return (z - cz) * US_FT

    # --- subject ---------------------------------------------------------
    subj = raw[SUBJECT_BIN]
    ground_ring = clean_ring([local(x, y) for x, y in zip(*subj["ground"][0][:2])])
    roofs = [(clean_ring([local(x, y) for x, y in zip(xs, ys)]), local_z(z)) for xs, ys, z in subj["roofs"]]
    main_roof = max(roofs, key=lambda r: poly_area(r[0]))
    main_roof_m = main_roof[1]
    h = main_roof_m / STORIES
    print(f"subject: footprint {poly_area(ground_ring):.0f} m2, main roof {main_roof_m:.1f} m over "
          f"{len(main_roof[0])} vertices, {len(roofs)} roof polygons, floor-to-floor {h:.3f} m")

    quad, simplified, quad_dev = principal_quad(ground_ring)
    inner = inward_offset(quad, BAY_DEPTH_M)
    bays = build_bays(quad, inner, BAY_WIDTH_TARGET_M)
    core, core_angle = core_rect(quad, CORE_M)
    core = match_sides(inner, core)
    print(f"plate: rectangle {poly_area(quad):.0f} m2 (survey outline {poly_area(ground_ring):.0f}), max deviation {quad_dev:.2f} m; "
          f"{len(bays)} bays; core {CORE_M[0]}x{CORE_M[1]} m at {core_angle:.1f} deg")

    # --- context (shared by every example floor) --------------------------
    def build_context(glb, skip_floor):
        nodes = []
        mat = glb.material("context", (0.72, 0.71, 0.68, 1.0))
        tri_count = 0
        for b, rec in raw.items():
            if b == SUBJECT_BIN or not rec["ground"] or not rec["roofs"]:
                continue
            gz = min(local_z(z) for _, _, z in rec["ground"])
            mb = MeshBuilder()
            for xs, ys, z in rec["roofs"]:
                ring = clean_ring([local(x, y) for x, y in zip(xs, ys)])
                if len(ring) < 3 or poly_area(ring) < 0.5:
                    continue
                top = local_z(z)
                if top - gz < 0.5:
                    continue
                mb.prism(ring, gz, top)
            if mb.empty():
                continue
            tri_count += len(mb.idx) // 3
            nodes.append(glb.node(f"context_{b}", glb.mesh(f"context_{b}", mb, mat)))
        # the subject's other stories
        n = skip_floor
        below = MeshBuilder()
        below.prism(ground_ring, 0.0, (n - 1) * h)
        above = MeshBuilder()
        for ring, top in roofs:
            if top > n * h + 0.5:
                above.prism(ring, n * h, top)
        nodes.append(glb.node("context_subject_below", glb.mesh("context_subject_below", below, mat)))
        nodes.append(glb.node("context_above_subject", glb.mesh("context_above_subject", above, mat)))
        tri_count += (len(below.idx) + len(above.idx)) // 3
        # ground
        g = MeshBuilder()
        G = GROUND_HALF_M
        g.quad((-G, -G, -0.05), (G, -G, -0.05), (G, G, -0.05), (-G, G, -0.05))
        gmat = glb.material("context_ground", (0.80, 0.79, 0.76, 1.0))
        nodes.append(glb.node("context_ground", glb.mesh("context_ground", g, gmat)))
        return nodes, tri_count

    # --- the space -------------------------------------------------------
    def build_space(glb, n):
        z_slab0 = (n - 1) * h
        z_floor = z_slab0 + SLAB_M           # finished floor
        z_ceil = n * h - SLAB_M              # underside of the ceiling slab
        z_surf = z_floor + SURFACE_LIFT_M
        z_csurf = z_ceil - SURFACE_LIFT_M
        opaque = glb.material("space_opaque", (0.93, 0.92, 0.89, 1.0))
        analysis = glb.material("space_analysis", (0.96, 0.96, 0.94, 1.0))
        glass = glb.material("glazing", (0.55, 0.75, 0.90, 0.30), roughness=0.2, blend=True)
        nodes = []
        rooms = []

        sf = MeshBuilder()
        sf.prism(quad, z_slab0, z_floor, top=True, bottom=True)
        nodes.append(glb.node("slab_floor", glb.mesh("slab_floor", sf, opaque)))
        sc = MeshBuilder()
        sc.prism(quad, z_ceil, n * h, top=True, bottom=True)
        nodes.append(glb.node("slab_ceiling", glb.mesh("slab_ceiling", sc, opaque)))

        # ceiling surface, whole plate, facing down
        ce = MeshBuilder()
        ce.face([(x, y, z_csurf) for x, y in reversed(quad)])
        nodes.append(glb.node("ceiling", glb.mesh("ceiling", ce, analysis)))

        # exterior wall: spandrels per edge, glazing per bay
        sp = MeshBuilder()
        for i in range(4):
            A, B = quad[i], quad[(i + 1) % 4]
            sp.quad((A[0], A[1], z_floor), (B[0], B[1], z_floor), (B[0], B[1], z_floor + SILL_M), (A[0], A[1], z_floor + SILL_M))
            sp.quad((A[0], A[1], z_floor + HEAD_M), (B[0], B[1], z_floor + HEAD_M), (B[0], B[1], z_ceil), (A[0], A[1], z_ceil))
        nodes.append(glb.node("wall_spandrel", glb.mesh("wall_spandrel", sp, opaque)))

        glazing_area = {}
        for name, oa, ob, ib, ia, edge in bays:
            gl = MeshBuilder()
            gl.quad((oa[0], oa[1], z_floor + SILL_M), (ob[0], ob[1], z_floor + SILL_M), (ob[0], ob[1], z_floor + HEAD_M), (oa[0], oa[1], z_floor + HEAD_M))
            nodes.append(glb.node(f"glazing_{name}", glb.mesh(f"glazing_{name}", gl, glass)))
            glazing_area[name] = math.hypot(ob[0] - oa[0], ob[1] - oa[1]) * (HEAD_M - SILL_M)

        # bay floors and partitions
        for name, oa, ob, ib, ia, edge in bays:
            rf = MeshBuilder()
            rf.face([(oa[0], oa[1], z_surf), (ob[0], ob[1], z_surf), (ib[0], ib[1], z_surf), (ia[0], ia[1], z_surf)])
            nodes.append(glb.node(f"room_{name}", glb.mesh(f"room_{name}", rf, analysis)))
            pw = MeshBuilder()
            # inner (corridor) wall
            pw.quad((ia[0], ia[1], z_floor), (ib[0], ib[1], z_floor), (ib[0], ib[1], z_ceil), (ia[0], ia[1], z_ceil))
            # partition on the bay's 'a' side (each bay owns one side wall so none is doubled)
            pw.quad((oa[0], oa[1], z_floor), (ia[0], ia[1], z_floor), (ia[0], ia[1], z_ceil), (oa[0], oa[1], z_ceil))
            nodes.append(glb.node(f"wall_room_{name}", glb.mesh(f"wall_room_{name}", pw, opaque)))
            rooms.append({
                "id": name,
                "edge": edge,
                "floor_m2": round(poly_area([oa, ob, ib, ia]), 2),
                "glazing_m2": round(glazing_area[name], 2),
                "frontage_m": round(math.hypot(ob[0] - oa[0], ob[1] - oa[1]), 2),
                "depth_m": round(BAY_DEPTH_M, 3),
                "glazing_to_floor": round(glazing_area[name] / poly_area([oa, ob, ib, ia]), 4),
            })

        # core
        cm = MeshBuilder()
        cm.prism(core, z_floor, z_ceil, top=False, bottom=False)
        nodes.append(glb.node("core", glb.mesh("core", cm, opaque)))

        # the deep interior: inner quad minus core, as four trapezoids
        fl = MeshBuilder()
        for i in range(4):
            O0, O1 = inner[i], inner[(i + 1) % 4]
            C0, C1 = core[i], core[(i + 1) % 4]
            fl.face([(O0[0], O0[1], z_surf), (O1[0], O1[1], z_surf), (C1[0], C1[1], z_surf), (C0[0], C0[1], z_surf)])
        nodes.append(glb.node("floor_interior", glb.mesh("floor_interior", fl, analysis)))
        interior_area = poly_area(inner) - poly_area(core)

        return nodes, rooms, {
            "finished_floor_m": round(z_floor, 3),
            "ceiling_m": round(z_ceil, 3),
            "room_height_m": round(z_ceil - z_floor, 3),
            "sill_m": round(z_floor + SILL_M, 3),
            "head_m": round(z_floor + HEAD_M, 3),
            "interior_floor_m2": round(interior_area, 1),
            "core_m2": round(poly_area(core), 1),
            "bays_m2": round(sum(r["floor_m2"] for r in rooms), 1),
            "plate_m2": round(poly_area(quad), 1),
        }

    files = {}
    rooms_ref = None
    for n in EXAMPLE_FLOORS:
        glb = GLB()
        ctx_nodes, ctx_tris = build_context(glb, n)
        sp_nodes, rooms, levels = build_space(glb, n)
        rooms_ref = rooms
        ctx_root = glb.node("context", children=ctx_nodes)
        sp_root = glb.node("space", children=sp_nodes, extras={"floor": n, "stories": STORIES})
        name = f"example-f{n:02d}.glb"
        size = glb.write(out / name, [ctx_root, sp_root], {
            "site": {"latitude": round(lat, 6), "longitude": round(lon, 6), "north": "-Z (glTF), +Y in the Rhino model"},
            "units": "meters",
            "subject": "25 Water Street, Manhattan (BIN 1000007), floor %d of %d" % (n, STORIES),
        })
        files[name] = {"bytes": size, "floor": n, "context_triangles": ctx_tris, "levels": levels}
        print(f"write: {name} {size / 1e6:.2f}MB, floor {n}, context {ctx_tris:,} triangles, "
              f"finished floor {levels['finished_floor_m']} m")

    manifest = {
        "sandbox": "sunlight",
        "generated": "2026-09-06",
        "subject": {
            "name": "25 Water Street",
            "former_name": "4 New York Plaza",
            "bin": int(SUBJECT_BIN),
            "bbl": "1000050010",
            "pluto_address": "115 BROAD STREET",
            "pluto_26v2": {"YearBuilt": 1969, "NumFloors": 32, "UnitsRes": 1320, "ResArea": 995416, "BldgFront_ft": 148, "BldgDepth_ft": 276,
                           "note": "The PLUTO row describes the building after conversion (ten stories added). The survey used here is from 2014 and shows the 22-story office building."},
            "storeys_in_survey": STORIES,
            "footprint_survey_m2": round(poly_area(ground_ring), 1),
            "main_roof_m": round(main_roof_m, 2),
            "roof_polygons": len(roofs),
            "conversion": "From 2023, about 1,300 apartments, ten stories added, two courtyards cut into the plate (New York YIMBY, 2023-07; Wikipedia).",
        },
        "site": {"latitude": round(lat, 6), "longitude": round(lon, 6), "timezone": "America/New_York",
                 "origin_epsg2263_ft": [round(cx, 2), round(cy, 2), round(cz, 2)],
                 "origin_note": "Vertex-mean center of the subject's surveyed ground ring, at its surveyed ground elevation (NAVD88 feet in the source). Grid north of EPSG:2263 differs from true north here by about 0.007 degrees, ignored."},
        "axes": {"model": "+X east, +Y north, +Z up (Rhino, top view)",
                 "gltf": "+X east, +Y up, -Z north; the writer applies (x, y, z) -> (x, z, -y), the same as Rhino's 'Map Rhino Z to glTF Y'"},
        "floor_to_floor_m": round(h, 4),
        "example_floors": EXAMPLE_FLOORS,
        "files": files,
        "context": {"radius_ft": CONTEXT_RADIUS_FT, "buildings": len(raw) - 1,
                    "method": "one prism per RoofSurface polygon, from the building's lowest ground-surface elevation to the roof polygon's mean elevation",
                    "ground_plane_half_m": GROUND_HALF_M,
                    "delivery_areas_scanned": ["DA12 (holds everything)", "DA19", "DA11", "DA13 (nothing in the box)"]},
        "plate": {
            "method": "surveyed outline simplified (Douglas-Peucker 1.5 m), rotated onto its longest edge, each of the four sides taken as the length-weighted mean of its edges, corners by intersection",
            "quad_m": [[round(x, 3), round(y, 3)] for x, y in quad],
            "quad_m2": round(poly_area(quad), 1),
            "survey_outline_m2": round(poly_area(ground_ring), 1),
            "max_deviation_m": round(quad_dev, 2),
            "max_deviation_note": "largest distance from a surveyed outline vertex to the rectangle's boundary; the jogs are at the two short ends",
            "simplified_outline_m": [[round(x, 3), round(y, 3)] for x, y in simplified],
        },
        "assumptions": [
            {"key": "floor_to_floor", "value_m": round(h, 4), "who": "ours", "note": "22 stories divided evenly into the surveyed 86.0 m main roof. The survey knows the roof, not the floors."},
            {"key": "slab_thickness", "value_m": SLAB_M, "who": "ours"},
            {"key": "glazing_band", "sill_m": SILL_M, "head_m": HEAD_M, "who": "ours", "note": "continuous around the perimeter; the real 1969 facade is strip windows with spandrels, not measured"},
            {"key": "bay_depth", "value_m": BAY_DEPTH_M, "who": "ours", "note": "30 ft, a common residential bay depth"},
            {"key": "bay_width_target", "value_m": BAY_WIDTH_TARGET_M, "who": "ours", "note": "25 ft; each edge is divided into the nearest whole number of bays"},
            {"key": "core", "value_m": list(CORE_M), "who": "ours", "note": "a single rectangle centered on the plate, aligned with its long edge; the real core is not in any public dataset"},
            {"key": "interior_rings", "who": "pipeline", "note": "CityGML interior rings (courtyards) are extruded as solids; DA12 has six, none near the subject"},
        ],
        "rooms": rooms_ref,
        "tags": {
            "context": "opaque, casts and receives shadows, not analyzed",
            "space": "group; everything below is analyzed",
            "room_<id>": "planar floor patch, one row in the room table",
            "floor*": "analyzed floor surface belonging to no room",
            "ceiling*": "analyzed",
            "wall*, core*, partition*": "opaque, casts shadows, analyzed",
            "slab*": "opaque, casts shadows, not analyzed (the floor and ceiling surfaces 1 cm off its faces are)",
            "context_above*": "context that the cut-away view hides from the camera; it still casts shadows",
            "glazing_<id>": "transparent to the sun, translucent in the view, not analyzed; <id> ties it to room_<id>",
            "match": "prefix, case-insensitive, on node name, then mesh name, then material name",
        },
        "light_and_air_rules": {
            "mdl_30": {"window_to_floor": 0.10, "min_window_sf": 12, "source": "NY Multiple Dwelling Law s.30(8)(a), read 2026-09-06 (law.justia.com)",
                       "depth_rule": "s.30(3): rooms in apartments of three rooms or fewer may not extend more than 30 ft from a window on a lawful court; not applied to larger apartments"},
            "mdl_277": {"window_to_floor": "0.10 below 500 sf of living-room floor area, less 0.01 per additional 100 sf, floor 0.05",
                        "court": "a court at least 15 ft perpendicular to the window and 100 sf",
                        "source": "NY Multiple Dwelling Law s.277, read 2026-09-06 (law.justia.com, newyork.public.law)",
                        "eligibility_note": "the text read gives buildings occupied non-residentially before 1 Jan 1977 in a city over one million; the widely reported 2024 change to 31 Dec 1990 was not visible in either mirror and is UNVERIFIED"},
        },
        "sources": [
            "DCP 3-D Building Model, CityGML 2.0, NYC Open Data tnru-abg2 (2014 aerial survey), delivery area DA12",
            "NYC Building Footprints (BUILDING_20260830.geojson): bin 1000007 -> base_bbl 1000050010, used only to identify the subject",
            "MapPLUTO 26v2 (MapPLUTO.dbf/.shp): BBL 1000050010, used only to identify the subject",
            "25 Water Street, Wikipedia (read 2026-09-06): formerly 4 New York Plaza, Carson Lundin & Shaw, 1969, 22 stories, 1.1M sf, CetraRuddy conversion, ten stories added",
            "New York YIMBY, 2023-07-xx (read 2026-09-06): two central courtyards cut into the plate, ~1,300 units",
        ],
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"write: manifest.json; {len(rooms_ref)} rooms, plate {manifest['plate']['quad_m2']} m2")


if __name__ == "__main__":
    main()
