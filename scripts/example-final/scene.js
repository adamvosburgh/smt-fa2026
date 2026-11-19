// Example Project interactive: words + trees tumbling in white space.
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import fontJson from './font/helvetiker_bold.typeface.json';

// seeded, so screenshots repeat
let seed = Number(new URLSearchParams(location.search).get('seed') ?? 7);
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const range = (a, b) => a + rand() * (b - a);

const BOX = 46;
const params = { speed: 1, chaos: 0.5, trees: 70, spin: 1, size: 1, fog: 0.35, paused: false };

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
scene.fog = new THREE.Fog(0xffffff, 40, 140);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 6, 78);

scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8d0, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(30, 50, 40);
scene.add(sun);

// words
const font = new FontLoader().parse(fontJson);
const wordMat = new THREE.MeshStandardMaterial({ color: 0x2424e0, roughness: 0.45, metalness: 0.05 });
const words = ['SIMULATIONS', 'MODELS', 'TWINS'].map((w) => {
  const g = new TextGeometry(w, { font, size: 5, depth: 1.6, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.18, bevelSegments: 2 });
  g.center();
  return g;
});

// trees: conifer, round, poplar
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.9, flatShading: true });
const greens = [0x2f6b3a, 0x3f8a44, 0x567d2e, 0x6b9a3c, 0x24543a, 0x7fae5a].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true })
);
function treeGeometry(kind) {
  const trunk = new THREE.CylinderGeometry(0.22, 0.32, 3, 6).translate(0, 1.5, 0);
  let crown;
  if (kind === 0) {
    crown = mergeGeometries([
      new THREE.ConeGeometry(2.2, 3.4, 7).translate(0, 3.6, 0),
      new THREE.ConeGeometry(1.7, 2.8, 7).translate(0, 5.0, 0),
      new THREE.ConeGeometry(1.1, 2.2, 7).translate(0, 6.3, 0)
    ]);
  } else if (kind === 1) {
    crown = mergeGeometries([
      new THREE.IcosahedronGeometry(2.1, 0).translate(0, 4.4, 0),
      new THREE.IcosahedronGeometry(1.4, 0).translate(1.3, 3.8, 0.4),
      new THREE.IcosahedronGeometry(1.3, 0).translate(-1.1, 4.0, -0.6)
    ]);
  } else {
    crown = new THREE.IcosahedronGeometry(1, 1).scale(1.1, 3.2, 1.1).translate(0, 5.2, 0);
  }
  return { trunk, crown };
}
const treeKinds = [0, 1, 2].map(treeGeometry);

const bodies = [];
function spawn(mesh, mass) {
  mesh.position.set(range(-BOX, BOX), range(-BOX * 0.6, BOX * 0.6), range(-BOX, BOX * 0.5));
  mesh.rotation.set(range(0, 6.28), range(0, 6.28), range(0, 6.28));
  const b = {
    mesh,
    mass,
    base: mesh.scale.x,
    v: new THREE.Vector3(range(-1, 1), range(-1, 1), range(-1, 1)).multiplyScalar(4 / mass),
    w: new THREE.Vector3(range(-1, 1), range(-1, 1), range(-1, 1)).multiplyScalar(1.2 / mass)
  };
  bodies.push(b);
  scene.add(mesh);
  return b;
}

for (const g of words) {
  for (let i = 0; i < 2; i++) spawn(new THREE.Mesh(g, wordMat), 2.2);
}

let treeBodies = [];
function makeTree() {
  const k = treeKinds[Math.floor(rand() * 3)];
  const t = new THREE.Group();
  t.add(new THREE.Mesh(k.trunk, trunkMat));
  t.add(new THREE.Mesh(k.crown, greens[Math.floor(rand() * greens.length)]));
  const s = Math.pow(range(0.3, 1), 1.6) * 3;
  t.scale.setScalar(s);
  return spawn(t, 0.6 + s * 0.5);
}
function setTrees(n) {
  while (treeBodies.length < n) treeBodies.push(makeTree());
  while (treeBodies.length > n) {
    const b = treeBodies.pop();
    scene.remove(b.mesh);
    bodies.splice(bodies.indexOf(b), 1);
  }
}
setTrees(params.trees);

// controls (no labels)
const ui = document.createElement('div');
ui.id = 'ui';
ui.innerHTML = `
  <label>Speed<input type="range" data-k="speed" min="0" max="4" step="0.01" value="${params.speed}"></label>
  <label>Chaos<input type="range" data-k="chaos" min="0" max="2" step="0.01" value="${params.chaos}"></label>
  <label>Trees<input type="range" data-k="trees" min="0" max="240" step="1" value="${params.trees}"></label>
  <label>Spin<input type="range" data-k="spin" min="0" max="4" step="0.01" value="${params.spin}"></label>
  <label>Size<input type="range" data-k="size" min="0.3" max="2.5" step="0.01" value="${params.size}"></label>
  <label>Fog<input type="range" data-k="fog" min="0" max="1" step="0.01" value="${params.fog}"></label>
  <div class="row">
    <button data-a="pause" aria-label="pause">&#10073;&#10073;</button>
    <button data-a="scatter" aria-label="scatter">&#10042;</button>
    <button data-a="reset" aria-label="reset">&#8634;</button>
  </div>`;
document.body.appendChild(ui);
ui.addEventListener('input', (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  params[k] = Number(e.target.value);
  if (k === 'trees') setTrees(params.trees);
  if (k === 'size') for (const b of bodies) b.mesh.scale.setScalar(b.base * params.size);
});
ui.addEventListener('click', (e) => {
  const a = e.target.closest('button')?.dataset.a;
  if (a === 'pause') { params.paused = !params.paused; e.target.closest('button').classList.toggle('on', params.paused); }
  if (a === 'scatter') for (const b of bodies) b.v.add(new THREE.Vector3(range(-1, 1), range(-1, 1), range(-1, 1)).multiplyScalar(18 / b.mass));
  if (a === 'reset') location.reload();
});

// drag to orbit
let yaw = 0, pitch = 0.05, dragging = null;
addEventListener('pointerdown', (e) => { if (!e.target.closest('#ui')) dragging = { x: e.clientX, y: e.clientY, yaw, pitch }; });
addEventListener('pointerup', () => (dragging = null));
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yaw = dragging.yaw - (e.clientX - dragging.x) * 0.005;
  pitch = Math.max(-1.2, Math.min(1.2, dragging.pitch + (e.clientY - dragging.y) * 0.005));
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
const kick = new THREE.Vector3();
let t = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05) * (params.paused ? 0 : params.speed);
  t += dt;
  for (const b of bodies) {
    kick.set(range(-1, 1), range(-1, 1), range(-1, 1)).multiplyScalar((params.chaos * 14 * dt) / b.mass);
    b.v.add(kick).multiplyScalar(1 - 0.08 * dt);
    b.w.x += range(-1, 1) * params.chaos * dt; b.w.y += range(-1, 1) * params.chaos * dt; b.w.z += range(-1, 1) * params.chaos * dt;
    b.w.multiplyScalar(1 - 0.05 * dt);
    const p = b.mesh.position.addScaledVector(b.v, dt);
    for (const ax of ['x', 'y', 'z']) {
      const lim = ax === 'y' ? BOX * 0.7 : BOX;
      if (p[ax] > lim) p[ax] -= 2 * lim;
      if (p[ax] < -lim) p[ax] += 2 * lim;
    }
    const s = dt * params.spin;
    b.mesh.rotation.x += b.w.x * s; b.mesh.rotation.y += b.w.y * s; b.mesh.rotation.z += b.w.z * s;
  }
  const r = 78;
  const ay = yaw + t * 0.03;
  camera.position.set(Math.sin(ay) * Math.cos(pitch) * r, Math.sin(pitch) * r + 6, Math.cos(ay) * Math.cos(pitch) * r);
  camera.lookAt(0, 0, 0);
  scene.fog.near = 20 + (1 - params.fog) * 120;
  scene.fog.far = scene.fog.near + 40 + (1 - params.fog) * 200;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
window.__ready = true;
