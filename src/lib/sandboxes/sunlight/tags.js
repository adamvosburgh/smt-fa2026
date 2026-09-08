// The model contract, in code.
//
// A student's file is read by NAME, not by structure, because that is the one
// thing every exporter carries through. Tags are matched by prefix,
// case-insensitive, on the node name first, then the mesh name, then the
// material name; the first match wins. That tolerance is deliberate: Rhino's
// glTF exporter and Blender's disagree about which of the three a Rhino object
// name ends up in, and the sandbox should not care.
//
// Nothing here imports three.js. It takes objects that quack like three's
// Object3D and a resolver for the mesh name, so the classifier can be read and
// checked on its own.

// Longest prefix first, so `context_above` is not eaten by `context`.
// `core` and `partition` share the wall role; `slab` is opaque and casts but is
// not analyzed, because the floor and ceiling surfaces sitting 1 cm off its two
// faces are the surfaces the study is about.
const PREFIXES = [
  ['context_above', 'contextAbove'],
  ['context', 'context'],
  ['glazing', 'glazing'],
  ['room', 'room'],
  ['ceiling', 'ceiling'],
  ['slab', 'slab'],
  ['floor', 'floor'],
  ['wall', 'wall'],
  ['core', 'wall'],
  ['partition', 'wall'],
  ['space', 'space']
];

// Roles that put a mesh inside the space, whatever its ancestry.
export const SPACE_ROLES = new Set(['room', 'floor', 'ceiling', 'wall', 'slab', 'glazing']);
// Roles that get sample points and appear in the metrics.
export const ANALYSED_ROLES = new Set(['room', 'floor', 'ceiling', 'wall']);
// Roles that block the sun. Glazing does not: the sun passes through it. Rooms,
// floors and ceilings do not either - they receive, and a floor patch that cast
// would shadow the ceiling below it in a model that has no floor below it.
export const CASTING_ROLES = new Set(['context', 'contextAbove', 'wall', 'slab']);

// One name to a role. Returns null when nothing matches.
export function classifyName(name) {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  for (const [prefix, role] of PREFIXES) {
    if (n.startsWith(prefix)) {
      // room_01 -> "01", glazing_01 -> "01". A bare `room` gets an empty id and
      // is treated as one unnamed room.
      const id = n.slice(prefix.length).replace(/^[_\-. ]+/, '');
      return { role, id, prefix };
    }
  }
  return null;
}

// The full classification of one mesh: node name, then mesh name, then material
// name. `meshNameOf` is supplied by the caller because three's GLTFLoader
// overwrites a Mesh's name with the NODE's name whenever a node has one, so the
// glTF mesh name has to be recovered from the parser's associations table.
export function classifyMesh(obj, meshNameOf) {
  for (const [source, name] of [
    ['node', obj.name],
    ['mesh', meshNameOf ? meshNameOf(obj) : null],
    ['material', obj.material?.name]
  ]) {
    const hit = classifyName(name);
    if (hit) return { ...hit, source, name };
  }
  return { role: 'other', id: '', source: null, name: obj.name ?? '' };
}

// --- the input report -----------------------------------------------------
//
// Written into the panel above the controls and into onmetrics. This is the
// student's check that their model was read the way they meant it, so it is not
// optional and it is not hidden. For the class example it reads:
//
//   context 555, rooms 34, floor 1, ceiling 1, walls/core/partitions 38,
//   glazing 34, untagged 0; space 90.5 x 3.9 x 60.8 m
//
// The walls figure counts slabs with the walls, because a slab is the same thing
// to the sun as a wall is and the report is about what casts, not about how many
// buckets the classifier has.
export function buildIndex(root, { meshNameOf } = {}) {
  const entries = [];
  const stack = [{ obj: root, inSpace: false }];

  while (stack.length) {
    const { obj, inSpace } = stack.pop();
    const own = classifyName(obj.name);
    const under = inSpace || own?.role === 'space';
    if (obj.isMesh) {
      const tag = classifyMesh(obj, meshNameOf);
      entries.push({
        mesh: obj,
        role: tag.role === 'space' ? 'other' : tag.role,
        id: tag.id,
        source: tag.source,
        inSpace: under || SPACE_ROLES.has(tag.role)
      });
    }
    for (const child of obj.children ?? []) stack.push({ obj: child, inSpace: under });
  }

  entries.sort((a, b) => (a.mesh.name < b.mesh.name ? -1 : a.mesh.name > b.mesh.name ? 1 : 0));
  return entries;
}

export function countRoles(entries) {
  const c = { context: 0, room: 0, floor: 0, ceiling: 0, wall: 0, glazing: 0, other: 0 };
  for (const e of entries) {
    if (e.role === 'context' || e.role === 'contextAbove') c.context++;
    else if (e.role === 'wall' || e.role === 'slab') c.wall++;
    else if (c[e.role] !== undefined) c[e.role]++;
    else c.other++;
  }
  return c;
}

// `box` is {min:{x,y,z}, max:{x,y,z}} over the meshes in the space, or null.
// `analysedArea` is in square meters, `glazingOrphans` the panes that could not
// be tied to a room.
export function inputReport({ counts, box, analysedArea, glazingOrphans = 0, rooms = 0, elapsedMs = null }) {
  const size = box
    ? [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z]
    : null;
  const problems = [];
  if (!counts.room && !counts.floor && !counts.ceiling && !counts.wall && !counts.glazing) {
    problems.push('No `space` was found. Nothing in the file is tagged room, floor, ceiling, wall, core or glazing, so there is nothing to analyze.');
  }
  if (!analysedArea) {
    problems.push('No analyzed surfaces. Tag at least one floor patch `room_01` or `floor_something`.');
  }
  if (glazingOrphans) {
    problems.push(`${glazingOrphans} glazing pane${glazingOrphans === 1 ? '' : 's'} could not be matched to a room. Name a pane after the room it belongs to, as glazing_01 beside room_01.`);
  }
  if (counts.other) {
    problems.push(`${counts.other} mesh${counts.other === 1 ? ' is' : 'es are'} untagged, and ${counts.other === 1 ? 'is' : 'are'} being treated as context. Untagged geometry casts shadows and is not analyzed.`);
  }
  if (size) {
    const largest = Math.max(...size);
    if (largest < 1) problems.push(`The space is ${largest.toFixed(2)} m across. The file is probably not in meters.`);
    else if (largest > 500) problems.push(`The space is ${largest.toFixed(0)} m across. The file is probably not in meters, or context has been tagged as space.`);
  }

  const line =
    `context ${counts.context}, rooms ${counts.room}, floor ${counts.floor}, ` +
    `ceiling ${counts.ceiling}, walls/core/partitions ${counts.wall}, ` +
    `glazing ${counts.glazing}, untagged ${counts.other}` +
    (size ? `; space ${size[0].toFixed(1)} × ${size[1].toFixed(1)} × ${size[2].toFixed(1)} m` : '');

  return { line, counts, size, rooms, analysedArea, problems, elapsedMs };
}
