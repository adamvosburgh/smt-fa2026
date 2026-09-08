// The room table, and the two light-and-air rules it applies.
//
// Everything here is measured from the triangles in the file the sandbox was
// given, never read from a manifest, so a student's model is measured the same
// way the class example is. For the example the figures come back equal to the
// pipeline's own: room_01 61.33 m² of floor and 11.31 m² of glazing, room_12
// 52.68 and 10.93. If those two ever disagree, the browser and the pipeline are
// measuring different geometry and one of them is wrong.
//
// three.js is passed in rather than imported.

export const SQ_FT_PER_SQ_M = 10.763910416709722;
// 30 ft, the depth limit in MDL §30(3), and the depth of a bay in the example.
export const DEPTH_LIMIT_M = 9.144;

// Area, area-weighted centroid, and vertical extent of one baked geometry.
export function measure(THREE, geometry) {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const tris = index ? index.count / 3 : pos.count / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  let area = 0;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let t = 0; t < tris; t++) {
    const ia = index ? index.getX(t * 3) : t * 3;
    const ib = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const ic = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    const at = 0.5 * n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).length();
    area += at;
    centroid.x += ((a.x + b.x + c.x) / 3) * at;
    centroid.y += ((a.y + b.y + c.y) / 3) * at;
    centroid.z += ((a.z + b.z + c.z) / 3) * at;
    minY = Math.min(minY, a.y, b.y, c.y);
    maxY = Math.max(maxY, a.y, b.y, c.y);
  }
  if (area > 0) centroid.multiplyScalar(1 / area);
  return { area, centroid, minY, maxY };
}

// A glazing pane, seen from above, is a line. Take the two vertices furthest
// apart in plan; everything the metrics ask of a pane ("how far is this floor
// point from a window") is a distance to that line.
export function planSegment(THREE, geometry) {
  const pos = geometry.getAttribute('position');
  let best = null;
  for (let i = 0; i < pos.count; i++) {
    for (let j = i + 1; j < pos.count; j++) {
      const dx = pos.getX(i) - pos.getX(j);
      const dz = pos.getZ(i) - pos.getZ(j);
      const d2 = dx * dx + dz * dz;
      if (!best || d2 > best.d2) {
        best = { d2, x1: pos.getX(i), z1: pos.getZ(i), x2: pos.getX(j), z2: pos.getZ(j) };
      }
    }
  }
  return best ?? { d2: 0, x1: 0, z1: 0, x2: 0, z2: 0 };
}

export function distanceToSegment(x, z, s) {
  const dx = s.x2 - s.x1;
  const dz = s.z2 - s.z1;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - s.x1) * dx + (z - s.z1) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = s.x1 + t * dx;
  const pz = s.z1 + t * dz;
  return Math.hypot(x - px, z - pz);
}

export function nearestGlazing(x, z, segments) {
  let best = Infinity;
  for (const s of segments) {
    const d = distanceToSegment(x, z, s);
    if (d < best) best = d;
  }
  return best;
}

// Perpendicular distance from a point to the LINE a glazing pane lies in, in
// plan. This is how far the room extends from its window wall, which is the
// quantity MDL §30(3) limits to 30 ft.
//
// NOT distanceToSegment, and the difference is not academic. The example's bays
// are trapezoids that narrow towards the core, so the far corner of a bay that
// is exactly 30 ft deep is 10.8 m from the nearest END of its window - and 28 of
// the 34 rooms would report as over the limit for being exactly on it. The
// statute says a room may not extend more than 30 ft FROM a window, which is a
// depth measured off the window wall, so that is what is measured.
export function distanceToLine(x, z, s) {
  const dx = s.x2 - s.x1;
  const dz = s.z2 - s.z1;
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return Math.hypot(x - s.x1, z - s.z1);
  return Math.abs(dx * (z - s.z1) - dz * (x - s.x1)) / len;
}

export function depthFromGlazing(x, z, segments) {
  let best = Infinity;
  for (const s of segments) {
    const d = distanceToLine(x, z, s);
    if (d < best) best = d;
  }
  return best;
}

// --- the two rules --------------------------------------------------------
//
// §30(8)(a): the total window area of a room must be at least one tenth of that
// room's floor area, and every window at least 12 square feet.
//
// §277: ten per cent under 500 square feet of floor area, one percentage point
// less for each additional 100 square feet, never below five per cent. So 660
// square feet needs 9 per cent and 567 square feet needs 10.
//
// Both read from the statute on 2026-09-06; the citations are in
// data/processed/sunlight/manifest.json. The eligibility test in §277 (a
// building occupied non-residentially before a cut-off date) is not applied -
// the sandbox has no idea what your building was.
export function requiredRatio(rule, floorAreaM2) {
  if (rule !== 'mdl277') return 0.1;
  const sf = floorAreaM2 * SQ_FT_PER_SQ_M;
  const over = Math.max(0, sf - 500);
  return Math.max(0.05, 0.1 - 0.01 * Math.floor(over / 100));
}

export function roomPasses(room, rule, depthRule) {
  if (!(room.floorArea > 0)) return false;
  const need = requiredRatio(rule, room.floorArea);
  let ok = room.ratio >= need - 1e-9;
  // §30 also sets a floor under each individual window. §277 states the ratio
  // only, so the 12 sq ft test is not applied there.
  if (rule === 'mdl30') {
    ok = ok && room.panes.length > 0 && room.panes.every((p) => p.area * SQ_FT_PER_SQ_M >= 12 - 1e-9);
  }
  // §30(3): how far the room extends from its window wall, in plan. Measured
  // from the floor patch's own vertices rather than from sample points, so the
  // answer does not move when the grid changes. The example's bays are exactly
  // 30 ft deep, so they sit on the limit and pass; the tolerance is a
  // millimetre.
  if (depthRule) ok = ok && room.depth <= DEPTH_LIMIT_M + 0.001;
  return ok;
}

// --- building the table ---------------------------------------------------
//
// A pane belongs to the room whose id it shares. A pane with no matching room
// goes to the room whose floor patch is nearest to it in plan, within 1 m, and
// otherwise to none - which the input report calls out, because an unmatched
// pane means a room's ratio is being reported as zero.
export function buildRooms({ THREE, surfaces }) {
  const rooms = new Map();
  const panes = [];

  for (const s of surfaces) {
    if (s.role === 'room') {
      const stats = measure(THREE, s.geometry);
      let room = rooms.get(s.id);
      if (!room) {
        room = {
          id: s.id,
          floorArea: 0,
          glazingArea: 0,
          ratio: 0,
          depth: 0,
          panes: [],
          meshes: [],
          floorCentroid: new THREE.Vector3(),
          floorLevel: Infinity,
          glazingCentroid: null
        };
        rooms.set(s.id, room);
      }
      room.meshes.push(s);
      room.floorCentroid.addScaledVector(stats.centroid, stats.area);
      room.floorArea += stats.area;
      room.floorLevel = Math.min(room.floorLevel, stats.minY);
    } else if (s.role === 'glazing') {
      const stats = measure(THREE, s.geometry);
      panes.push({ id: s.id, area: stats.area, centroid: stats.centroid, segment: planSegment(THREE, s.geometry), surface: s });
    }
  }

  for (const room of rooms.values()) {
    if (room.floorArea > 0) room.floorCentroid.multiplyScalar(1 / room.floorArea);
    if (!Number.isFinite(room.floorLevel)) room.floorLevel = 0;
  }

  let orphans = 0;
  for (const pane of panes) {
    let room = rooms.get(pane.id);
    if (!room) {
      // Nearest floor PATCH in plan, not nearest floor center: a pane sits on a
      // room's edge, which can be several meters from that room's middle.
      let best = null;
      for (const r of rooms.values()) {
        let near = Infinity;
        for (const s of r.meshes) {
          const pos = s.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i++) {
            near = Math.min(near, Math.hypot(pane.centroid.x - pos.getX(i), pane.centroid.z - pos.getZ(i)));
          }
        }
        if (!best || near < best.d) best = { d: near, room: r };
      }
      if (best && best.d <= 1) room = best.room;
    }
    if (!room) { orphans++; continue; }
    room.panes.push(pane);
    room.glazingArea += pane.area;
  }

  const list = [...rooms.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const room of list) {
    room.ratio = room.floorArea > 0 ? room.glazingArea / room.floorArea : 0;
    if (room.panes.length) {
      const c = new THREE.Vector3();
      let w = 0;
      for (const p of room.panes) { c.addScaledVector(p.centroid, p.area); w += p.area; }
      room.glazingCentroid = w > 0 ? c.multiplyScalar(1 / w) : room.panes[0].centroid.clone();
      // How far the floor patch reaches from its own window wall. Independent of
      // the sample grid, because it is measured from the patch's vertices.
      let depth = 0;
      const segments = room.panes.map((p) => p.segment);
      for (const s of room.meshes) {
        const pos = s.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          depth = Math.max(depth, depthFromGlazing(pos.getX(i), pos.getZ(i), segments));
        }
      }
      room.depth = depth;
    }
  }

  return { rooms: list, orphans, panes };
}
