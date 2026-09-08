// The cumulative view: how many of the period's sun positions reach each point
// on the analyzed surfaces.
//
// It is done on the GPU with a shadow map rather than with ray casting, so the
// sandbox has ONE mechanism for the picture and the number. The same depth image
// that draws the shadow at 14:00 decides whether a point was lit at 14:00.
//
// Per sun position:
//   1. render the occluders into a depth texture from an orthographic camera
//      pointed along the sun's direction, fitted tightly to the space;
//   2. run one fragment over every sample point, transform the point into that
//      camera's clip space, compare depth, and add the day's weight to a running
//      count if the point is unoccluded and facing the sun.
//
// The counter lives in the R and G channels of an RGBA8 render target, read as
// count = R * 256 + G, so it is exact to 65,535 and needs no float render target
// and no blending extension. Every WebGL2 device runs it the same way. The year
// is 880 passes and its largest possible count is 26,783 (see sun.js), which
// fits with room to spare.
//
// three.js is passed in rather than imported, so this module never pulls the
// library into a bundle that does not already have it.

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
precision highp sampler2D;
uniform sampler2D uPos;     // xyz world position, w room index
uniform sampler2D uNrm;     // xyz world normal, w surface index
uniform sampler2D uPrev;    // the running count, R*256+G
uniform sampler2D uDepth;   // the sun's depth image
uniform mat4 uLight;        // world -> the sun camera's clip space
uniform vec3 uSunDir;       // towards the sun, unit
uniform float uWeight;      // what one lit step is worth (a month's length, or 1)
uniform float uDepthBias;   // in normalized depth units
uniform float uNormalBias;  // in meters
varying vec2 vUv;

void main() {
  vec4 P = texture2D(uPos, vUv);
  vec4 N = texture2D(uNrm, vUv);
  vec4 prev = texture2D(uPrev, vUv);

  float count = floor(prev.r * 255.0 + 0.5) * 256.0 + floor(prev.g * 255.0 + 0.5);

  if (dot(N.xyz, uSunDir) > 0.0) {
    // Zero-thickness walls are both occluders and analyzed surfaces, so a point
    // on a wall lit at a grazing angle will shadow itself unless it is pushed
    // off its own surface by more than one shadow texel's worth of slope.
    vec4 lp = uLight * vec4(P.xyz + N.xyz * uNormalBias, 1.0);
    vec3 s = lp.xyz / lp.w * 0.5 + 0.5;
    bool inside = s.x > 0.0 && s.x < 1.0 && s.y > 0.0 && s.y < 1.0 && s.z > 0.0 && s.z < 1.0;
    float d = texture2D(uDepth, s.xy).x;
    if (!inside || s.z - uDepthBias <= d) count += uWeight;
  }

  float hi = floor(count / 256.0);
  gl_FragColor = vec4(hi / 255.0, (count - hi * 256.0) / 255.0, 0.0, 1.0);
}
`;

// --- sample points --------------------------------------------------------

// Tile every triangle of every analyzed surface with points on a grid of
// `gridM` spacing, in the triangle's own plane.
//
// The grid's two axes come from the PLANE's normal, not from the triangle's
// edges, so two coplanar triangles - the two halves of a floor patch - share one
// lattice and neither double-counts along their shared edge nor leaves a seam.
// A point is kept when it is strictly inside the triangle, which drops the
// handful of points that land exactly on a shared diagonal.
//
// Each point is pushed 1 cm off its surface along the normal. It carries its
// room and its surface so the room table and the hover readout can be built from
// the same array the GPU reads.
export function samplePoints({ THREE, surfaces, gridM, maxPoints = 262144 }) {
  const pos = [];
  const nrm = [];
  const roomOf = [];
  const surfaceOf = [];
  const areas = [];
  let truncated = false;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const p = new THREE.Vector3();

  outer: for (let si = 0; si < surfaces.length; si++) {
    const s = surfaces[si];
    const geo = s.mesh.geometry;
    const posAttr = geo.getAttribute('position');
    const index = geo.getIndex();
    const tris = index ? index.count / 3 : posAttr.count / 3;
    const m = s.mesh.matrixWorld;

    for (let t = 0; t < tris; t++) {
      const ia = index ? index.getX(t * 3) : t * 3;
      const ib = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const ic = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(posAttr, ia).applyMatrix4(m);
      b.fromBufferAttribute(posAttr, ib).applyMatrix4(m);
      c.fromBufferAttribute(posAttr, ic).applyMatrix4(m);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      n.crossVectors(ab, ac);
      const twiceArea = n.length();
      if (twiceArea < 1e-9) continue;
      n.multiplyScalar(1 / twiceArea);

      // A basis that depends only on the normal, so coplanar triangles agree.
      const ax = Math.abs(n.x);
      const ay = Math.abs(n.y);
      const az = Math.abs(n.z);
      u.set(0, 0, 0);
      if (ax <= ay && ax <= az) u.set(1, 0, 0);
      else if (ay <= az) u.set(0, 1, 0);
      else u.set(0, 0, 1);
      u.crossVectors(n, u).normalize();
      v.crossVectors(n, u);

      // Plane coordinates, measured from the world origin projected into the
      // plane, so the lattice is global rather than per-triangle.
      const au = a.dot(u), av = a.dot(v);
      const bu = b.dot(u), bv = b.dot(v);
      const cu = c.dot(u), cv = c.dot(v);
      const minU = Math.min(au, bu, cu), maxU = Math.max(au, bu, cu);
      const minV = Math.min(av, bv, cv), maxV = Math.max(av, bv, cv);
      const den = (bv - cv) * (au - cu) + (cu - bu) * (av - cv);
      if (Math.abs(den) < 1e-12) continue;
      const offset = a.dot(n);

      for (let i = Math.floor(minU / gridM); i <= Math.ceil(maxU / gridM); i++) {
        const pu = (i + 0.5) * gridM;
        if (pu < minU || pu > maxU) continue;
        for (let j = Math.floor(minV / gridM); j <= Math.ceil(maxV / gridM); j++) {
          const pv = (j + 0.5) * gridM;
          if (pv < minV || pv > maxV) continue;
          const l1 = ((bv - cv) * (pu - cu) + (cu - bu) * (pv - cv)) / den;
          const l2 = ((cv - av) * (pu - cu) + (au - cu) * (pv - cv)) / den;
          const l3 = 1 - l1 - l2;
          if (l1 <= 1e-9 || l2 <= 1e-9 || l3 <= 1e-9) continue;

          p.copy(u).multiplyScalar(pu)
            .addScaledVector(v, pv)
            .addScaledVector(n, offset + 0.01);
          if (pos.length / 4 >= maxPoints) { truncated = true; break outer; }
          pos.push(p.x, p.y, p.z, s.roomIndex ?? -1);
          nrm.push(n.x, n.y, n.z, si);
          roomOf.push(s.roomIndex ?? -1);
          surfaceOf.push(si);
          areas.push(gridM * gridM);
        }
      }
    }
  }

  const count = roomOf.length;
  const width = Math.max(1, Math.ceil(Math.sqrt(count)));
  const height = Math.max(1, Math.ceil(count / width));
  const position = new Float32Array(width * height * 4);
  const normal = new Float32Array(width * height * 4);
  position.set(pos);
  normal.set(nrm);
  // Padding texels get a normal of zero, so dot(n, sun) is never positive and
  // they never accumulate.

  return {
    count,
    width,
    height,
    position,
    normal,
    roomOf: Int32Array.from(roomOf),
    surfaceOf: Int32Array.from(surfaceOf),
    gridM,
    pointArea: gridM * gridM,
    truncated
  };
}


// --- fitting an orthographic camera to the sun ----------------------------
//
// LATERALLY the frustum is tight to the space's box plus a margin, because that
// is where the picture and the metric need their texels. ALONG THE LIGHT it
// spans the whole scene, because a tower two hundred meters away is what casts
// the shadow the space receives - a frustum tight in that direction would clip
// the caster out and report a shadowed floor as sunlit.
//
// Both the accumulation's own depth camera and the display's directional-light
// shadow camera are fitted by this, with different margins, so the shadow you
// see and the shadow that is counted are the same shape.
export function fitOrtho({ THREE, camera, dir, spaceBox, sceneBox, margin = 2, distance = null }) {
  const center = spaceBox.getCenter(new THREE.Vector3());
  const radius = sceneBox.getBoundingSphere(new THREE.Sphere()).radius;
  const d = distance ?? radius * 2 + 10;
  camera.position.copy(center).addScaledVector(dir, d);
  // Straight overhead, the default up vector is parallel to the view and the
  // camera's orientation is undefined.
  camera.up.set(0, 1, 0);
  if (Math.abs(dir.y) > 0.999) camera.up.set(0, 0, -1);
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

  const corner = new THREE.Vector3();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const box of [spaceBox, sceneBox]) {
    const lateral = box === spaceBox;
    for (let i = 0; i < 8; i++) {
      corner
        .set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
        .applyMatrix4(camera.matrixWorldInverse);
      if (lateral) {
        minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
        minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
      }
      minZ = Math.min(minZ, corner.z); maxZ = Math.max(maxZ, corner.z);
    }
  }
  camera.left = minX - margin;
  camera.right = maxX + margin;
  camera.bottom = minY - margin;
  camera.top = maxY + margin;
  // The camera looks down its own -Z, so the nearest thing has the largest z.
  camera.near = Math.max(0.1, -maxZ - 1);
  camera.far = -minZ + 1;
  camera.updateProjectionMatrix();
  return { distance: d, center };
}

// --- the accumulator ------------------------------------------------------

export function createAccumulator({ THREE, renderer, shadowSize = 2048 }) {
  const depthTexture = new THREE.DepthTexture(shadowSize, shadowSize, THREE.UnsignedIntType);
  depthTexture.minFilter = THREE.NearestFilter;
  depthTexture.magFilter = THREE.NearestFilter;
  const depthRT = new THREE.WebGLRenderTarget(shadowSize, shadowSize, {
    depthTexture,
    depthBuffer: true,
    stencilBuffer: false,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter
  });

  const sunCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const lightMatrix = new THREE.Matrix4();

  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene();
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uPos: { value: null },
      uNrm: { value: null },
      uPrev: { value: null },
      uDepth: { value: depthTexture },
      uLight: { value: lightMatrix },
      uSunDir: { value: new THREE.Vector3() },
      uWeight: { value: 1 },
      uDepthBias: { value: 0 },
      uNormalBias: { value: 0.05 }
    }
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  // The vertex shader writes clip space directly and ignores the camera, so the
  // camera's frustum has nothing to say about this mesh.
  quad.frustumCulled = false;
  quadScene.add(quad);

  let posTex = null;
  let nrmTex = null;
  let targets = null;
  let front = 0;
  let size = { width: 1, height: 1, count: 0 };

  function disposeTargets() {
    posTex?.dispose();
    nrmTex?.dispose();
    targets?.forEach((t) => t.dispose());
    posTex = nrmTex = targets = null;
  }

  function setPoints(points) {
    disposeTargets();
    size = points;
    posTex = new THREE.DataTexture(points.position, points.width, points.height, THREE.RGBAFormat, THREE.FloatType);
    nrmTex = new THREE.DataTexture(points.normal, points.width, points.height, THREE.RGBAFormat, THREE.FloatType);
    for (const t of [posTex, nrmTex]) {
      t.minFilter = THREE.NearestFilter;
      t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
    }
    const opts = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false
    };
    targets = [
      new THREE.WebGLRenderTarget(points.width, points.height, opts),
      new THREE.WebGLRenderTarget(points.width, points.height, opts)
    ];
    material.uniforms.uPos.value = posTex;
    material.uniforms.uNrm.value = nrmTex;
    reset();
  }

  function reset() {
    front = 0;
    if (!targets) return;
    const prevTarget = renderer.getRenderTarget();
    const prevColor = new THREE.Color();
    renderer.getClearColor(prevColor);
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 1);
    for (const t of targets) {
      renderer.setRenderTarget(t);
      renderer.clear(true, false, false);
    }
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevColor, prevAlpha);
  }

  function fitSun(dir, spaceBox, sceneBox, margin = 2) {
    fitOrtho({ THREE, camera: sunCam, dir, spaceBox, sceneBox, margin });
    lightMatrix.multiplyMatrices(sunCam.projectionMatrix, sunCam.matrixWorldInverse);
    // Two centimetres along the ray, expressed in this frustum's normalized
    // depth. The display shadow map's -0.0005 is in three's own units for its
    // own frustum and does not transfer here.
    material.uniforms.uDepthBias.value = 0.02 / Math.max(1, sunCam.far - sunCam.near);
    return sunCam;
  }

  // One sun position. `occluderScene` holds only what casts.
  function pass({ dir, weight, occluderScene, spaceBox, sceneBox }) {
    fitSun(dir, spaceBox, sceneBox);
    const prevTarget = renderer.getRenderTarget();
    // THE CUT-AWAY MUST NOT REACH THIS PASS. renderer.clippingPlanes is global,
    // and with it set the towers above the plate would be clipped out of the
    // sun's depth image and their shadows would vanish from the metric while
    // still falling across the picture.
    const prevClipping = renderer.clippingPlanes;
    renderer.clippingPlanes = [];

    renderer.setRenderTarget(depthRT);
    renderer.clear(true, true, false);
    renderer.render(occluderScene, sunCam);

    material.uniforms.uSunDir.value.copy(dir);
    material.uniforms.uWeight.value = weight;
    material.uniforms.uPrev.value = targets[front].texture;
    renderer.setRenderTarget(targets[1 - front]);
    renderer.render(quadScene, quadCam);
    front = 1 - front;

    renderer.clippingPlanes = prevClipping;
    renderer.setRenderTarget(prevTarget);
  }

  // One readback per period, decoded to counts.
  function read() {
    const buf = new Uint8Array(size.width * size.height * 4);
    renderer.readRenderTargetPixels(targets[front], 0, 0, size.width, size.height, buf);
    const out = new Uint16Array(size.count);
    for (let i = 0; i < size.count; i++) out[i] = buf[i * 4] * 256 + buf[i * 4 + 1];
    return out;
  }

  return {
    setPoints,
    reset,
    pass,
    read,
    fitSun,
    get sunCamera() { return sunCam; },
    dispose() {
      disposeTargets();
      depthRT.dispose();
      depthTexture.dispose();
      material.dispose();
    }
  };
}
