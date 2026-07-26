/*
 * Subway Hood — cyberpunk endless runner (Three.js + bloom).
 * Neon grid tunnel, rain, glowing obstacles/coins. 3 lanes: switch to dodge,
 * jump the low blocks, grab coins. Speed ramps up.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const LANES = [-2.2, 0, 2.2];
const PLAYER_Z = 5;
const SPAWN_Z = -75;
const RECYCLE_Z = 12;
const CYAN = 0x19f0ff, MAGENTA = 0xff2a6d, GOLD = 0xffd300, VIOLET = 0xa044ff;

let renderer, scene, camera, clock, composer;
let player, playerParts = {};
let world = new THREE.Group();
let obstacles = [], coins = [], buildings = [];
let floorMat, wallMats = [], rain, rainPos, rainCount = 520;
let raf = null;

const G = {
  running: false, mode: 'demo',
  lane: 1, targetX: 0, y: 0, vy: 0, grounded: true,
  speed: 18, baseSpeed: 18, maxSpeed: 48,
  distance: 0, score: 0, coins: 0, spawnClock: 0, runT: 0
};
const el = id => document.getElementById(id);

/* ---------- renderer / post ---------- */
function makeRenderer(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
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
function gridTexture(cell, line, bg, size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, size, size);
  x.strokeStyle = line; x.lineWidth = size * 0.035; x.shadowColor = line; x.shadowBlur = size * 0.06;
  const step = size / cell;
  for (let i = 0; i <= cell; i++) {
    x.beginPath(); x.moveTo(i * step, 0); x.lineTo(i * step, size); x.stroke();
    x.beginPath(); x.moveTo(0, i * step); x.lineTo(size, i * step); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function stripeTexture(color) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#05050c'; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 6; i++) {
    x.fillStyle = i % 2 ? color : 'rgba(255,255,255,0.02)';
    x.fillRect(10, i * 44 + 8, 44, 26);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 24);
  return t;
}

/* ---------- scene ---------- */
function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04040a);
  scene.fog = new THREE.Fog(0x04040a, 26, 72);

  camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 5.0, 10.5);
  camera.lookAt(0, 1.1, -10);

  scene.add(new THREE.AmbientLight(0x223055, 0.8));
  const key = new THREE.DirectionalLight(0xbcd0ff, 0.7); key.position.set(5, 14, 8); scene.add(key);
  const p1 = new THREE.PointLight(MAGENTA, 1.4, 70); p1.position.set(-7, 6, -8); scene.add(p1);
  const p2 = new THREE.PointLight(CYAN, 1.4, 70); p2.position.set(7, 6, -22); scene.add(p2);
  const p3 = new THREE.PointLight(VIOLET, 1.0, 60); p3.position.set(0, 8, -40); scene.add(p3);

  // neon grid floor
  floorMat = new THREE.MeshStandardMaterial({
    map: gridTexture(8, 'rgba(25,240,255,0.9)', '#06060f', 256),
    emissiveMap: gridTexture(8, 'rgba(25,240,255,0.9)', '#000000', 256),
    emissive: 0x0a3a44, emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.6
  });
  floorMat.map.repeat.set(6, 90); floorMat.emissiveMap.repeat.set(6, 90);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 400), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.z = -140; scene.add(floor);

  // neon side walls
  [[-6.4, MAGENTA, 'rgba(255,42,109,0.85)'], [6.4, CYAN, 'rgba(25,240,255,0.85)']].forEach(([x, col, css], i) => {
    const mat = new THREE.MeshStandardMaterial({
      map: stripeTexture(css), emissiveMap: stripeTexture(css),
      emissive: col, emissiveIntensity: 1.6, roughness: 0.5, side: THREE.DoubleSide
    });
    wallMats.push(mat);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 400), mat);
    wall.position.set(x, 3.4, -140); wall.rotation.y = i ? -Math.PI / 2 : Math.PI / 2;
    scene.add(wall);
  });

  scene.add(world);
  buildPlayer();
  buildBuildings();
  buildRain();
}

function neonMat(color, intensity) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity || 1.2, roughness: 0.4, metalness: 0.3 });
}

function buildPlayer() {
  player = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x1a1030, emissive: MAGENTA, emissiveIntensity: 0.5, roughness: 0.4 }));
  body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xffe0c0, roughness: 0.6 }));
  head.position.y = 1.95;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.8), neonMat(CYAN, 1.4));
  hood.position.y = 2.2;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.05), neonMat(CYAN, 2.2));
  visor.position.set(0, 1.98, 0.31);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.7, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x24244a, emissive: 0x0a0a20 }));
  legL.position.set(-0.24, 0.35, 0);
  const legR = legL.clone(); legR.position.x = 0.24;
  player.add(body, head, hood, visor, legL, legR);
  playerParts = { legL, legR };
  player.position.set(0, 0, PLAYER_Z);
  scene.add(player);
}

function buildBuildings() {
  for (let i = 0; i < 22; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const hgt = 6 + Math.random() * 10;
    const col = Math.random() < 0.5 ? CYAN : MAGENTA;
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, hgt, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x0b0b1c, emissive: col, emissiveIntensity: 0.25, roughness: 0.6 }));
    b.position.set(side * (8 + Math.random() * 5), hgt / 2 - 1, -i * 8 - Math.random() * 4);
    b.userData.side = side;
    buildings.push(b); world.add(b);
    // a glowing sign strip
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.15, hgt * 0.5, 0.15), neonMat(col, 2.0));
    s.position.set(b.position.x - side * 0.85, b.position.y, b.position.z);
    s.userData.parent = b; b.userData.sign = s; world.add(s);
  }
}

function buildRain() {
  const geo = new THREE.BufferGeometry();
  rainPos = new Float32Array(rainCount * 6);
  for (let i = 0; i < rainCount; i++) resetDrop(i, true);
  geo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending });
  rain = new THREE.LineSegments(geo, mat);
  rain.userData.vel = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) rain.userData.vel[i] = 26 + Math.random() * 20;
  scene.add(rain);
}
function resetDrop(i, anywhere) {
  const x = (Math.random() * 2 - 1) * 8;
  const z = PLAYER_Z - 8 - Math.random() * 46;
  const y = anywhere ? Math.random() * 16 : 14 + Math.random() * 4;
  const len = 0.6 + Math.random() * 0.9;
  const o = i * 6;
  rainPos[o] = x; rainPos[o + 1] = y + len; rainPos[o + 2] = z;
  rainPos[o + 3] = x; rainPos[o + 4] = y; rainPos[o + 5] = z;
}

/* ---------- pools ---------- */
function newObstacle() {
  const low = Math.random() < 0.4;
  const g = low ? new THREE.BoxGeometry(1.7, 0.7, 0.8) : new THREE.BoxGeometry(1.7, 2.0, 0.8);
  const col = low ? GOLD : MAGENTA;
  const o = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    color: 0x120814, emissive: col, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.2
  }));
  o.userData.low = low; o.userData.active = false; o.visible = false;
  obstacles.push(o); scene.add(o);
  return o;
}
function newCoin() {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 18),
    new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 1.5, metalness: 0.7, roughness: 0.25 }));
  c.rotation.x = Math.PI / 2; c.userData.active = false; c.visible = false;
  coins.push(c); scene.add(c);
  return c;
}
function getFree(pool, factory) { for (const p of pool) if (!p.userData.active) return p; return factory(); }

function spawn() {
  const lane = Math.floor(Math.random() * 3);
  const o = getFree(obstacles, newObstacle);
  o.userData.active = true; o.visible = true;
  o.position.set(LANES[lane], o.userData.low ? 0.35 : 1.0, SPAWN_Z);
  if (Math.random() < 0.85) {
    const clane = Math.floor(Math.random() * 3);
    for (let i = 0; i < 4; i++) {
      const c = getFree(coins, newCoin);
      c.userData.active = true; c.visible = true;
      c.position.set(LANES[clane], 1.0, SPAWN_Z - i * 2.2);
    }
  }
}

/* ---------- input ---------- */
function move(dir) { if (!G.running) return; G.lane = Math.max(0, Math.min(2, G.lane + dir)); G.targetX = LANES[G.lane]; }
function jump() { if (!G.running || !G.grounded) return; G.vy = 9.4; G.grounded = false; }
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

  // rain always animates (ambience even on menu)
  if (rain) {
    const vel = rain.userData.vel;
    for (let i = 0; i < rainCount; i++) {
      const o = i * 6; const d = vel[i] * dt;
      rainPos[o + 1] -= d; rainPos[o + 4] -= d;
      if (rainPos[o + 4] < -0.5) resetDrop(i, false);
    }
    rain.geometry.attributes.position.needsUpdate = true;
  }

  if (!G.running) { render(); return; }

  G.speed = Math.min(G.maxSpeed, G.baseSpeed + G.distance * 0.02);
  G.distance += G.speed * dt;
  G.score = Math.floor(G.distance) + G.coins * 25;
  el('hud-score').textContent = G.score.toLocaleString();
  el('hud-coins').textContent = G.coins;

  const dz = G.speed * dt;

  // player
  player.position.x += (G.targetX - player.position.x) * Math.min(1, dt * 14);
  G.vy -= 26 * dt; G.y += G.vy * dt;
  if (G.y <= 0) { G.y = 0; G.vy = 0; G.grounded = true; }
  player.rotation.z = (G.targetX - player.position.x) * 0.12;
  G.runT += dt * G.speed * 0.6;
  const swing = Math.sin(G.runT) * 0.5;
  if (playerParts.legL) { playerParts.legL.rotation.x = swing; playerParts.legR.rotation.x = -swing; }
  player.position.y = G.y + Math.abs(Math.sin(G.runT)) * 0.06;

  // scroll neon
  floorMat.map.offset.y -= dz * 0.0125;
  floorMat.emissiveMap.offset.y = floorMat.map.offset.y;
  wallMats.forEach(m => { m.map.offset.y -= dz * 0.01; m.emissiveMap.offset.y = m.map.offset.y; });

  // buildings recycle
  buildings.forEach(b => {
    b.position.z += dz;
    if (b.userData.sign) b.userData.sign.position.z = b.position.z;
    if (b.position.z > RECYCLE_Z) { b.position.z -= 176; if (b.userData.sign) b.userData.sign.position.z = b.position.z; }
  });

  // spawn
  G.spawnClock += dt;
  const gap = Math.max(0.52, 1.15 - G.distance * 0.0006);
  if (G.spawnClock >= gap) { G.spawnClock = 0; spawn(); }

  // obstacles
  for (const o of obstacles) {
    if (!o.userData.active) continue;
    o.position.z += dz;
    if (o.position.z > RECYCLE_Z) { o.userData.active = false; o.visible = false; continue; }
    if (Math.abs(o.position.z - PLAYER_Z) < 0.9 && Math.abs(o.position.x - player.position.x) < 1.1) {
      const clears = o.userData.low && G.y > 0.9;
      if (!clears) return gameOver();
    }
  }
  // coins
  for (const c of coins) {
    if (!c.userData.active) continue;
    c.position.z += dz; c.rotation.z += dt * 6;
    if (c.position.z > RECYCLE_Z) { c.userData.active = false; c.visible = false; continue; }
    if (Math.abs(c.position.z - PLAYER_Z) < 0.8 && Math.abs(c.position.x - player.position.x) < 0.9 && Math.abs(G.y) < 1.4) {
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
  G.running = true;
}
async function gameOver() {
  G.running = false;
  const addr = (window.SubwayWallet && window.SubwayWallet.address)
    ? window.SubwayWallet.short(window.SubwayWallet.address) : 'You (demo)';
  let rankLine = '';
  try {
    if (window.SubwayLeaderboard) {
      const res = await window.SubwayLeaderboard.submit({ addr, score: G.score, mode: G.mode });
      if (res && res.rank) rankLine = G.mode === 'compete'
        ? `You're #${res.rank} on the leaderboard.`
        : `Local rank #${res.rank} — hold ${window.CONFIG.tokenSymbol} to compete for the pool.`;
    }
  } catch (e) {}
  el('ov-title').textContent = 'Wasted';
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
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.95, 0.6, 0.6);
    composer.addPass(bloom);
    resize();
    bindInput();
    clock = new THREE.Clock();
    for (let i = 0; i < 8; i++) newObstacle();
    for (let i = 0; i < 20; i++) newCoin();
    tick();
  },
  start,
  get running() { return G.running; }
};
