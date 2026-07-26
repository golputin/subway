/*
 * Subway Hood — 3D city runner (Three.js), GTA-ish daytime street style.
 * Low-poly city: asphalt road, sidewalks, buildings, cars, props.
 * 3 lanes: switch to dodge tall obstacles, jump the low ones, grab coins.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const LANES = [-2.2, 0, 2.2];
const PLAYER_Z = 5;
const SPAWN_Z = -80;
const RECYCLE_Z = 12;

let renderer, scene, camera, clock, composer;
let player, playerParts = {}, shadowBlob;
let world = new THREE.Group();
let obstacles = [], coins = [], props = [];
let roadMat, PROP_SPAN = 120;
let rain = null; // unused (kept for compatibility)
let raf = null;

const G = {
  running: false, mode: 'demo',
  lane: 1, targetX: 0, y: 0, vy: 0, grounded: true,
  speed: 17, baseSpeed: 17, maxSpeed: 44,
  distance: 0, score: 0, coins: 0, spawnClock: 0, runT: 0, startMs: 0
};
const el = id => document.getElementById(id);
const mat = (c, r = 0.85, m = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

/* ---------- renderer / post ---------- */
function makeRenderer(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  resize();
  window.addEventListener('resize', resize);
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  if (composer) composer.setSize(w, h);
}

/* ---------- textures ---------- */
function skyTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, '#3f7fd0'); g.addColorStop(0.45, '#7db4e6'); g.addColorStop(0.72, '#bfe0f2'); g.addColorStop(1, '#e9f4fb');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  // sun
  const sun = x.createRadialGradient(770, 210, 10, 770, 210, 200);
  sun.addColorStop(0, 'rgba(255,250,225,1)'); sun.addColorStop(0.3, 'rgba(255,244,200,0.8)'); sun.addColorStop(1, 'rgba(255,244,200,0)');
  x.fillStyle = sun; x.beginPath(); x.arc(770, 210, 200, 0, 7); x.fill();
  // clouds
  x.fillStyle = 'rgba(255,255,255,0.9)';
  function cloud(cx, cy, s) { for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(cx + (i - 3) * s * 0.5, cy + Math.sin(i) * s * 0.15, s * (0.5 + Math.random() * 0.4), s * 0.4, 0, 0, 7); x.fill(); } }
  cloud(220, 220, 60); cloud(500, 150, 46); cloud(140, 380, 40); cloud(620, 340, 52);
  return new THREE.CanvasTexture(c);
}
function roadTexture() {
  // railway ballast (gravel) with wooden sleepers/ties across the track
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#5a5148'; x.fillRect(0, 0, 256, 256);
  // gravel noise
  for (let i = 0; i < 2200; i++) {
    const v = 60 + Math.random() * 70 | 0;
    x.fillStyle = `rgba(${v},${v - 8},${v - 18},0.5)`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // sleepers (ties)
  for (let y = 0; y < 256; y += 40) {
    x.fillStyle = '#3f2f21'; x.fillRect(0, y, 256, 22);
    x.fillStyle = 'rgba(120,92,64,0.45)'; x.fillRect(0, y, 256, 4);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, y + 19, 256, 3);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function windowTexture(base) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 256);
  // concrete streaks
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * 128, Math.random() * 256, 2, 30 + Math.random() * 40); }
  const cw = 18, ch = 24, gx = 10, gy = 12;
  for (let yy = gy; yy < 256 - ch; yy += ch + gy) {
    for (let xx = gx; xx < 128 - cw; xx += cw + gx) {
      const lit = Math.random() < 0.12;
      x.fillStyle = lit ? 'rgba(255,236,180,0.95)' : 'rgba(120,150,175,0.85)';
      x.fillRect(xx, yy, cw, ch);
      x.strokeStyle = 'rgba(30,35,45,0.7)'; x.lineWidth = 1.5; x.strokeRect(xx, yy, cw, ch);
    }
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}
function stripeTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  for (let i = -8; i < 20; i++) { x.fillStyle = i % 2 ? '#e2b400' : '#1c1c1c'; x.save(); x.translate(i * 16, 0); x.rotate(0.5); x.fillRect(0, -40, 10, 160); x.restore(); }
  return new THREE.CanvasTexture(c);
}

/* ---------- scene ---------- */
function buildScene() {
  scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xcfe2ef, 45, 130);

  camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 5.2, 11);
  camera.lookAt(0, 1.4, -14);

  scene.add(new THREE.HemisphereLight(0xdcefff, 0x6b6252, 1.0));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.5);
  sun.position.set(8, 18, 6); scene.add(sun);

  // track ballast
  roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 1.0, metalness: 0 });
  roadMat.map.repeat.set(1, 72);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 500), roadMat);
  road.rotation.x = -Math.PI / 2; road.position.z = -180; scene.add(road);

  // steel rails — two per lane
  const railMat = mat(0xcdd4db, 0.35, 0.9);
  const railGeo = new THREE.BoxGeometry(0.1, 0.14, 500);
  LANES.forEach(lx => [-0.68, 0.68].forEach(off => {
    const r = new THREE.Mesh(railGeo, railMat); r.position.set(lx + off, 0.11, -180); scene.add(r);
  }));

  // raised side platforms with yellow safety edge
  [-1, 1].forEach(s => {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 500), mat(0x9a9ca1, 0.95));
    plat.position.set(s * 6.3, 0.05, -180); scene.add(plat);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.54, 500), mat(0xf2c14e, 0.7));
    edge.position.set(s * 4.22, 0.08, -180); scene.add(edge);
  });

  scene.add(world);
  buildPlayer();
  buildCity();
  buildProps();
}

/* ---------- 3D character ---------- */
function makeCharacter() {
  const g = new THREE.Group();
  const HOODIE = 0xcf3b2b, HOOD = 0x9e2a1e, PANTS = 0x2b2f3a, SKIN = 0xecb488, SHOE = 0xf2f2f2;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.42), mat(HOODIE, 0.8));
  torso.position.y = 1.28; g.add(torso);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.42), mat(PANTS, 0.8));
  hips.position.y = 0.82; g.add(hips);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.44), mat(SKIN, 0.75));
  head.position.y = 1.99; g.add(head);
  // red cap (crown + front brim) — matches the token art; face points forward (-z)
  const CAP = 0xe0402e;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.52), mat(CAP, 0.75));
  cap.position.set(0, 2.32, 0); g.add(cap);
  const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.26), mat(CAP, 0.75));
  capBrim.position.set(0, 2.23, -0.32); g.add(capBrim);
  // eyes on the front of the face
  [-0.1, 0.1].forEach(ex => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.02), mat(0x1c130d, 0.5)); e.position.set(ex, 2.02, -0.23); g.add(e); });

  function limb(len, w, color, foot) {
    const grp = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat(color, 0.8));
    m.position.y = -len / 2; grp.add(m);
    if (foot) { const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.16, 0.42), mat(SHOE, 0.7)); s.position.set(0, -len + 0.02, -0.08); grp.add(s); }
    return grp;
  }
  const armL = limb(0.78, 0.2, HOODIE); armL.position.set(-0.47, 1.62, 0); g.add(armL);
  const armR = limb(0.78, 0.2, HOODIE); armR.position.set(0.47, 1.62, 0); g.add(armR);
  const legL = limb(0.8, 0.24, PANTS, true); legL.position.set(-0.18, 0.78, 0); g.add(legL);
  const legR = limb(0.8, 0.24, PANTS, true); legR.position.set(0.18, 0.78, 0); g.add(legR);

  return { group: g, parts: { armL, armR, legL, legR, torso } };
}
function buildPlayer() {
  const ch = makeCharacter();
  player = ch.group; playerParts = ch.parts;
  player.position.set(0, 0, PLAYER_Z);
  scene.add(player);
  // fake contact shadow
  shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.set(0, 0.03, PLAYER_Z + 0.1);
  scene.add(shadowBlob);
}

/* ---------- city ---------- */
const BASE_COLORS = ['#6d7076', '#7a5b47', '#8a8f98', '#5c6b7a', '#9a7d5c', '#726b82'];
const WIN_TEX = [];
function getWin() {
  if (WIN_TEX.length < 6) { const t = windowTexture(BASE_COLORS[WIN_TEX.length]); WIN_TEX.push(t); return t; }
  return WIN_TEX[(Math.random() * WIN_TEX.length) | 0];
}
function buildCity() {
  const spacing = 8, perCol = 10;
  PROP_SPAN = spacing * perCol;
  const cols = [
    { x: -8.5, w: 3.2, h: [8, 16] },
    { x: -13, w: 4.2, h: [14, 26] },
    { x: 8.5, w: 3.2, h: [8, 16] },
    { x: 13, w: 4.2, h: [14, 26] }
  ];
  cols.forEach(col => {
    for (let i = 0; i < perCol; i++) {
      const hgt = col.h[0] + Math.random() * (col.h[1] - col.h[0]);
      const wid = col.w * (0.75 + Math.random() * 0.5);
      const tex = getWin();
      const b = new THREE.Mesh(new THREE.BoxGeometry(wid, hgt, wid),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.05 }));
      b.position.set(col.x + (Math.random() - 0.5) * 2, hgt / 2 - 1, RECYCLE_Z - i * spacing);
      b.userData.span = PROP_SPAN;
      // rooftop block
      const roof = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.5, 1.0, wid * 0.5), mat(0x55575c, 0.9));
      roof.position.set(b.position.x, hgt - 0.5, b.position.z);
      roof.userData.follow = b;
      props.push(b, roof); world.add(b, roof);
    }
  });
}

/* ---------- roadside props ---------- */
function makeLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4, 8), mat(0x3a3d42, 0.6, 0.4));
  pole.position.y = 2; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.1), mat(0x3a3d42, 0.6, 0.4));
  arm.position.set(0.45, 3.9, 0); g.add(arm);
  const headM = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffdd88, emissiveIntensity: 0.4, roughness: 0.5 });
  const hd = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.24), headM); hd.position.set(0.9, 3.84, 0); g.add(hd);
  return g;
}
function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.4, 8), mat(0x5b3d26, 0.9));
  trunk.position.y = 0.7; g.add(trunk);
  const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), mat(0x3f7d3a, 0.9));
  c1.position.y = 1.9; g.add(c1);
  const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65, 0), mat(0x4a8f42, 0.9));
  c2.position.set(0.4, 1.6, 0.2); g.add(c2);
  return g;
}
function makeCar(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.58, 3.1), mat(color, 0.5, 0.35)); body.position.y = 0.62; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.56, 1.7), mat(color, 0.5, 0.35)); cab.position.set(0, 1.08, -0.15); g.add(cab);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 1.55), mat(0x22303c, 0.2, 0.7)); glass.position.set(0, 1.12, -0.15); g.add(glass);
  const wGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 14), wMat = mat(0x111114, 0.9, 0);
  [[-0.76, 0.34, 1.05], [0.76, 0.34, 1.05], [-0.76, 0.34, -1.05], [0.76, 0.34, -1.05]].forEach(p => { const w = new THREE.Mesh(wGeo, wMat); w.rotation.z = Math.PI / 2; w.position.set(p[0], p[1], p[2]); g.add(w); });
  const lm = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xfff2c0, emissiveIntensity: 0.5 });
  [[-0.5, 0.6, 1.56], [0.5, 0.6, 1.56]].forEach(p => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.05), lm); l.position.set(p[0], p[1], p[2]); g.add(l); });
  return g;
}
const CAR_COLORS = [0xb23b3b, 0x2f5fa0, 0x2d2d33, 0xd9b23a, 0xf2f2f2, 0x3a7d4f];
const TRAIN_COLORS = [0xf2c14e, 0xd13a29, 0x2f7fc4, 0x2e9e5b, 0xe6e8ea, 0xe87b1f];

/* a subway/metro train car */
function makeTrainCar(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 3.5), mat(color, 0.5, 0.3)); body.position.y = 1.05; g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.28, 3.5), mat(0xdfe3e6, 0.6, 0.2)); roof.position.y = 1.94; g.add(roof);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.5, 3.02), mat(0x1b2a33, 0.2, 0.7)); band.position.y = 1.36; g.add(band);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.16, 3.5), mat(0x20242c, 0.5)); stripe.position.y = 0.7; g.add(stripe);
  // doors
  [-0.9, 0.9].forEach(z => { const d = new THREE.Mesh(new THREE.BoxGeometry(1.86, 1.0, 0.06), mat(0x20242c, 0.6)); d.position.set(0, 1.0, z); g.add(d); });
  // headlights on the near end
  const lm = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xfff2c0, emissiveIntensity: 0.55 });
  [[-0.5, 0.6, 1.77], [0.5, 0.6, 1.77]].forEach(p => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.05), lm); l.position.set(p[0], p[1], p[2]); g.add(l); });
  g.userData.low = false; return g;
}

/* trackside signal + junction box */
function makeSignalBox() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.9), mat(0x59636f, 0.85)); box.position.y = 0.7; g.add(box);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), mat(0x2f333a, 0.6, 0.4)); pole.position.set(0.42, 1.3, 0); g.add(pole);
  const rMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.6 });
  const gMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x2ecc71, emissiveIntensity: 0.25 });
  const r = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), rMat); r.position.set(0.42, 2.45, 0.14); g.add(r);
  const gr = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), gMat); gr.position.set(0.42, 2.12, 0.14); g.add(gr);
  g.userData.low = false; return g;
}

/* overhead line (catenary) pole */
function makeCatenary() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 6.2, 8), mat(0x6b6f76, 0.6, 0.4)); pole.position.y = 3.1; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.13, 0.13), mat(0x6b6f76, 0.6, 0.4)); arm.position.set(-1.5, 5.7, 0); g.add(arm);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), mat(0x40444a, 0.8)); base.position.y = 0.15; g.add(base);
  return g;
}

function buildProps() {
  const spacing = 12;
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 10; i++) {
      const roll = Math.random();
      let p, y = 0.3;
      if (roll < 0.5) { p = makeCatenary(); p.rotation.y = s < 0 ? 0 : Math.PI; y = 0.3; }
      else if (roll < 0.82) { p = makeTrainCar(TRAIN_COLORS[(Math.random() * TRAIN_COLORS.length) | 0]); p.scale.set(0.95, 0.95, 1.5); }
      else { p = makeSignalBox(); p.rotation.y = s < 0 ? -0.3 : 0.3; }
      p.position.set(s * (5.7 + Math.random() * 0.7), y, RECYCLE_Z - i * spacing - (s < 0 ? 0 : 6));
      p.userData.span = 120;
      props.push(p); world.add(p);
    }
  }
}

/* ---------- obstacle rig (multiple kinds, one active) ---------- */
function makeBarrier() {
  const g = new THREE.Group();
  const tex = stripeTexture(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 1);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  board.position.y = 1.0; g.add(board);
  const board2 = board.clone(); board2.position.y = 0.5; g.add(board2);
  [-0.8, 0.8].forEach(x => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), mat(0xdddddd, 0.6)); leg.position.set(x, 0.65, 0); g.add(leg); });
  g.userData.low = false; return g;
}
function makeDumpster() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.15, 1.3), mat(0x2f7d4f, 0.8)); b.position.y = 0.6; g.add(b);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.16, 1.35), mat(0x256a42, 0.7)); lid.position.y = 1.24; g.add(lid);
  g.userData.low = false; return g;
}
function makeCones() {
  const g = new THREE.Group();
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a15, roughness: 0.7 });
  [-0.55, 0, 0.55].forEach((x, i) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.62, 14), coneMat); c.position.set(x, 0.31, (i - 1) * 0.15); g.add(c);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), coneMat); base.position.set(x, 0.03, (i - 1) * 0.15); g.add(base);
  });
  g.userData.low = true; return g;
}
function makeCrates() {
  const g = new THREE.Group();
  const cm = mat(0x9c6b34, 0.9);
  [[-0.4, 0.35, 0], [0.4, 0.35, 0], [0, 0.35, -0.4], [0, 0.9, 0]].forEach(p => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), cm); c.position.set(p[0], p[1], p[2]); g.add(c);
  });
  g.userData.low = true; return g;
}
function newObstacle() {
  const rig = new THREE.Group();
  const kinds = {
    train: makeTrainCar(TRAIN_COLORS[(Math.random() * TRAIN_COLORS.length) | 0]),
    barrier: makeBarrier(),
    signal: makeSignalBox(),
    cones: makeCones(),
    crates: makeCrates()
  };
  Object.values(kinds).forEach(k => { k.visible = false; rig.add(k); });
  rig.userData.kinds = kinds; rig.userData.active = false; rig.visible = false;
  obstacles.push(rig); scene.add(rig);
  return rig;
}
function getFreeObstacle() { for (const o of obstacles) if (!o.userData.active) return o; return newObstacle(); }
function newCoin() {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 18),
    new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffb000, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.3 }));
  c.rotation.x = Math.PI / 2; c.userData.active = false; c.visible = false;
  coins.push(c); scene.add(c);
  return c;
}
function getFreeCoin() { for (const c of coins) if (!c.userData.active) return c; return newCoin(); }

const KIND_KEYS = ['train', 'barrier', 'signal', 'cones', 'crates'];
function placeObstacle(lane) {
  const rig = getFreeObstacle();
  const key = KIND_KEYS[(Math.random() * KIND_KEYS.length) | 0];
  Object.entries(rig.userData.kinds).forEach(([k, m]) => { m.visible = (k === key); });
  const active = rig.userData.kinds[key];
  rig.userData.low = !!active.userData.low;
  // trains rush toward the player (oncoming) for extra tension
  rig.userData.rush = (key === 'train') ? (6 + Math.random() * 7) : 0;
  rig.userData.active = true; rig.visible = true;
  rig.position.set(LANES[lane], 0, SPAWN_Z);
  return rig;
}
function spawn() {
  // pick 1-2 lanes to block, always leave at least one open
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  const blockCount = Math.random() < 0.45 ? 2 : 1;
  const blocked = lanes.slice(0, blockCount);
  blocked.forEach(l => placeObstacle(l));
  // coins in an open lane
  const open = [0, 1, 2].filter(l => !blocked.includes(l));
  const clane = open[(Math.random() * open.length) | 0];
  for (let i = 0; i < 5; i++) {
    const c = getFreeCoin(); c.userData.active = true; c.visible = true;
    c.position.set(LANES[clane], 1.0, SPAWN_Z - i * 2.0);
  }
}

/* ---------- input ---------- */
function move(dir) { if (!G.running) return; G.lane = Math.max(0, Math.min(2, G.lane + dir)); G.targetX = LANES[G.lane]; }
function jump() { if (!G.running || !G.grounded) return; G.vy = 9.6; G.grounded = false; }
function bindInput() {
  window.addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') move(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') move(1);
    else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); jump(); }
  });
  let sx = 0, sy = 0;
  window.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy)) { if (Math.abs(dx) > 30) move(dx > 0 ? 1 : -1); }
    else if (dy < -30) jump();
  }, { passive: true });
}

/* ---------- loop ---------- */
function tick() {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!G.running) { render(); return; }

  G.speed = Math.min(G.maxSpeed, G.baseSpeed + G.distance * 0.02);
  G.distance += G.speed * dt;
  G.score = Math.floor(G.distance) + G.coins * 25;
  el('hud-score').textContent = G.score.toLocaleString();
  el('hud-coins').textContent = G.coins;
  const dz = G.speed * dt;

  // player lateral + jump + run cycle
  player.position.x += (G.targetX - player.position.x) * Math.min(1, dt * 14);
  G.vy -= 27 * dt; G.y += G.vy * dt;
  if (G.y <= 0) { G.y = 0; G.vy = 0; G.grounded = true; }
  player.rotation.z = (G.targetX - player.position.x) * 0.1;
  G.runT += dt * G.speed * 0.62;
  const sw = Math.sin(G.runT);
  if (playerParts.legL) {
    playerParts.legL.rotation.x = sw * 0.8; playerParts.legR.rotation.x = -sw * 0.8;
    playerParts.armL.rotation.x = -sw * 0.7; playerParts.armR.rotation.x = sw * 0.7;
    playerParts.torso.rotation.x = -0.09;
  }
  player.position.y = G.y + Math.abs(sw) * 0.05;
  if (shadowBlob) { shadowBlob.position.x = player.position.x; const sc = 1 - Math.min(0.6, G.y * 0.25); shadowBlob.scale.set(sc, sc, sc); shadowBlob.material.opacity = 0.32 * sc; }

  // scroll road
  roadMat.map.offset.y -= dz * 0.0166;

  // props + city recycle
  for (const p of props) {
    if (p.userData.follow) { p.position.z = p.userData.follow.position.z; continue; }
    p.position.z += dz;
    const span = p.userData.span || PROP_SPAN;
    if (p.position.z > RECYCLE_Z) p.position.z -= span;
  }

  // spawn
  G.spawnClock += dt;
  const gap = Math.max(0.5, 1.0 - G.distance * 0.0006);
  if (G.spawnClock >= gap) { G.spawnClock = 0; spawn(); }

  // obstacles
  for (const o of obstacles) {
    if (!o.userData.active) continue;
    o.position.z += dz + (o.userData.rush || 0) * dt;
    if (o.position.z > RECYCLE_Z) { o.userData.active = false; o.visible = false; continue; }
    if (Math.abs(o.position.z - PLAYER_Z) < 1.0 && Math.abs(o.position.x - player.position.x) < 1.2) {
      const clears = o.userData.low && G.y > 0.85;
      if (!clears) return gameOver();
    }
  }
  // coins
  for (const c of coins) {
    if (!c.userData.active) continue;
    c.position.z += dz; c.rotation.z += dt * 6;
    if (c.position.z > RECYCLE_Z) { c.userData.active = false; c.visible = false; continue; }
    if (Math.abs(c.position.z - PLAYER_Z) < 0.8 && Math.abs(c.position.x - player.position.x) < 0.9 && Math.abs(G.y) < 1.5) {
      c.userData.active = false; c.visible = false; G.coins++;
    }
  }

  render();
}
function render() { composer ? composer.render() : renderer.render(scene, camera); }

/* ---------- states ---------- */
function reset() {
  obstacles.forEach(o => { o.userData.active = false; o.visible = false; });
  coins.forEach(c => { c.userData.active = false; c.visible = false; });
  Object.assign(G, { lane: 1, targetX: 0, y: 0, vy: 0, grounded: true, speed: G.baseSpeed, distance: 0, score: 0, coins: 0, spawnClock: 0, runT: 0 });
  player.position.set(0, 0, PLAYER_Z);
}
function start(mode) {
  G.mode = mode || (window.SubwayWallet ? window.SubwayWallet.mode : 'demo');
  reset();
  el('overlay').classList.add('hidden');
  const badge = el('mode-badge');
  badge.textContent = G.mode === 'compete' ? 'COMPETE' : 'DEMO';
  badge.className = 'mode-badge ' + (G.mode === 'compete' ? 'compete' : 'demo');
  G.startMs = performance.now();
  // ask the backend (if configured) for an anti-cheat session token
  try { window.SubwayLeaderboard && window.SubwayLeaderboard.startSession && window.SubwayLeaderboard.startSession(); } catch (e) {}
  G.running = true;
}
async function gameOver() {
  G.running = false;
  const addr = (window.SubwayWallet && window.SubwayWallet.address)
    ? window.SubwayWallet.short(window.SubwayWallet.address) : 'You (demo)';
  let rankLine = '';
  try {
    if (window.SubwayLeaderboard) {
      const res = await window.SubwayLeaderboard.submit({
        addr,
        address: (window.SubwayWallet && window.SubwayWallet.address) || null,
        score: G.score, coins: G.coins, mode: G.mode,
        durationMs: Math.max(0, Math.round(performance.now() - G.startMs))
      });
      if (res && res.rank) rankLine = G.mode === 'compete'
        ? `You're #${res.rank} on the leaderboard.`
        : `Local rank #${res.rank} — hold ${window.CONFIG.tokenSymbol} to compete for the pool.`;
    }
  } catch (e) {}
  el('ov-title').textContent = 'Busted';
  el('ov-emoji').style.display = 'none';
  el('ov-score').style.display = 'block';
  el('ov-score').textContent = G.score.toLocaleString();
  el('ov-sub').innerHTML = `Coins: <b>${G.coins}</b> · Mode: <b>${G.mode.toUpperCase()}</b><br>${rankLine}`;
  el('btn-start').textContent = 'Run Again';
  el('overlay').classList.remove('hidden');
}

/* ---------- public ---------- */
window.SubwayGame = {
  init() {
    makeRenderer(el('game-canvas'));
    buildScene();
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.28, 0.5, 0.9);
    composer.addPass(bloom);
    resize();
    bindInput();
    clock = new THREE.Clock();
    for (let i = 0; i < 10; i++) newObstacle();
    for (let i = 0; i < 24; i++) newCoin();
    tick();
  },
  start,
  get running() { return G.running; }
};
