// The two camera placements.
//
// Both are rules rather than fixed numbers, because the sandbox has to place a
// camera in a model it has never seen. Both rules exist because the obvious
// placement failed on the class example:
//
//   Exterior: from the south-east at 45 degrees, 125 Broad Street fills the
//   frame and 25 Water Street is behind it. So the rule tests eight directions
//   and takes the one with the longest clear line to the subject.
//
//   Interior: the center of the space is inside the core. So the rule stands in
//   the largest room instead, at eye height, looking at its window.
//
// three.js is passed in rather than imported.

const COMPASS = [
  // South-east first, so it wins a tie. In the file's axes north is -Z and east
  // is +X, so south-east is (+1, 0, +1) normalized.
  ['south-east', 1, 1],
  ['north', 0, -1],
  ['north-east', 1, -1],
  ['east', 1, 0],
  ['south', 0, 1],
  ['south-west', -1, 1],
  ['west', -1, 0],
  ['north-west', -1, -1]
];

// Elevation 40 degrees, distance 2.5 x the space's diagonal, azimuth chosen by
// raycasting each of the eight compass directions at the space and keeping the
// one whose first hit is farthest away. A direction that hits nothing at all is
// a clear view and wins outright.
export function exteriorPlacement({ THREE, spaceBox, occluders }) {
  const target = spaceBox.getCenter(new THREE.Vector3());
  const diagonal = spaceBox.getSize(new THREE.Vector3()).length();
  const distance = 2.5 * diagonal;
  const elevation = (40 * Math.PI) / 180;
  const raycaster = new THREE.Raycaster();
  const position = new THREE.Vector3();
  const direction = new THREE.Vector3();

  let best = null;
  for (const [name, ex, ez] of COMPASS) {
    const len = Math.hypot(ex, ez) || 1;
    position
      .set((ex / len) * Math.cos(elevation), Math.sin(elevation), (ez / len) * Math.cos(elevation))
      .multiplyScalar(distance)
      .add(target);
    direction.subVectors(target, position).normalize();
    raycaster.set(position, direction);
    raycaster.far = distance * 1.2;
    const hits = occluders.length ? raycaster.intersectObjects(occluders, true) : [];
    const clearance = hits.length ? hits[0].distance : Infinity;
    if (!best || clearance > best.clearance) {
      best = { name, clearance, position: position.clone() };
    }
  }

  return { position: best.position, target, from: best.name, fov: 45 };
}

// Eye 1.6 m above the floor of the room with the largest floor area, looking
// horizontally at that room's glazing. Ties go to the room whose glazing sits
// furthest south, which in the file's axes is the largest +Z, and then to name
// order. With no rooms at all it stands over the largest floor surface and looks
// at the center of the space.
export function interiorPlacement({ THREE, rooms, floors, spaceBox }) {
  const candidates = rooms.filter((r) => r.floorArea > 0);
  if (candidates.length) {
    const best = candidates.slice().sort((a, b) => {
      if (Math.abs(b.floorArea - a.floorArea) > 1e-6) return b.floorArea - a.floorArea;
      const az = a.glazingCentroid?.z ?? -Infinity;
      const bz = b.glazingCentroid?.z ?? -Infinity;
      if (Math.abs(bz - az) > 1e-6) return bz - az;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })[0];
    const eye = best.floorCentroid.clone();
    eye.y = best.floorLevel + 1.6;
    const look = (best.glazingCentroid ?? spaceBox.getCenter(new THREE.Vector3())).clone();
    look.y = eye.y;
    return { position: eye, target: look, room: best.id, fov: 70 };
  }

  const floor = floors.slice().sort((a, b) => b.area - a.area)[0];
  const center = spaceBox.getCenter(new THREE.Vector3());
  const eye = (floor?.centroid ?? center).clone();
  eye.y = (floor?.level ?? spaceBox.min.y) + 1.6;
  const look = center.clone();
  look.y = eye.y;
  return { position: eye, target: look, room: null, fov: 70 };
}
