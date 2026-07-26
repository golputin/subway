/*
 * Subway Hood — endless runner (Three.js, ES module).
 * Simple, light 3-lane runner: switch lanes to dodge, jump to clear low blocks,
 * grab coins for bonus. Speed ramps up over time.
 */
import * as THREE from 'three';

const LANES = [-2.2, 0, 2.2];
const PLAYER_Z = 5;
const SPAWN_Z = -70;
const RECYCLE_Z = 12;

let renderer, scene, camera, clock;
let player, playerParts = {};
let world = new THREE.Group();
let obstacles = [], coins = [], dashes = [], pillars = [];
let raf = null;

const G = {
  running: false,
  mode: 'demo',
  lane: 1,
  targetX: 0,
  y: 0, vy: 0, grounded: true,
  speed: 18, baseSpeed: 18, maxSpeed: 46,
  distance: 0, score: 0, coins: 0,
  spawnClock: 0, spawnGap: 1.15,
  runT: 0
};

const el = id => document.getElementById(id);

/* ---------- build ---------- */
function makeRenderer(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  resize();
  window.addEventListener('resize', resize);
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
}

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a18);
  scene.fog = new THREE.Fog(0x0a0a18, 30, 70);

  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 5.2, 10);
  camera.lookAt(0, 1.2, -8);

  scene.add(new THREE.AmbientLight(0x8899ff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(6, 14, 8);
  scene.add(key);
  const rim = new THREE.PointLight(0xff2d78, 0.9, 60);
  rim.position.set(-8, 6, -10);
  scene.add(rim);
  const rim2 = new THREE.PointLight(0x18e0ff, 0.9, 60);
  rim2.position.set(8, 6, -20);
  scene.add(rim2);

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 220),
    new THREE.MeshStandardMaterial({ color: 0x141428, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -80;
  scene.add(ground);

  // side rails (neon)
  [-4.2, 4.2].forEach((x, i) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.3, 220),
      new THREE.MeshBasicMaterial({ color: i ? 0x18e0ff : 0xff2d78 })
    );
    rail.position.set(x, 0.15, -80);
    scene.add(rail);
  });

  scene.add(world);
  buildPlayer();
  buildDecor();
}

function buildPlayer() {
  player = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.1, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xff2d78, roughness: 0.5 })
  );
  body.position.y = 1.15;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xffe0c0, roughness: 0.6 })
  );
  head.position.y = 1.95;
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.5, 0.78),
    new THREE.MeshStandardMaterial({ color: 0x18e0ff, roughness: 0.4, emissive: 0x0a3a44 })
  );
  hood.position.y = 2.2;
  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.7, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x2a2a44 })
  );
  legL.position.set(-0.24, 0.35, 0);
  const legR = legL.clone(); legR.position.x = 0.24;
  player.add(body, head, hood, legL, legR);
  playerParts = { legL, legR, body };
  player.position.set(0, 0, PLAYER_Z);
  scene.add(player);
}

function buildDecor() {
  // moving lane dashes
  for (let i = 0; i < 24; i++) {
    const d = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.02, 1.4),
      new THREE.MeshBasicMaterial({ color: 0x3a3a66 })
    );
    d.position.set(LANES[i % 2 === 0 ? 0 : 2] / 2, 0.02, -i * 4);
    d.userData.baseX = (i % 3 - 1) * 1.1;
    d.position.x = d.userData.baseX;
    dashes.push(d); world.add(d);
  }
  // side pillars (tunnel vibe)
  for (let i = 0; i < 16; i++) {
    const side = i % 2 === 0 ? -5 : 5;
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 5 + Math.random() * 3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1c1c3a })
    );
    p.position.set(side, 2.5, -i * 9);
    pillars.push(p); world.add(p);
  }
}

/* ---------- pools ---------- */
function newObstacle() {
  const low = Math.random() < 0.4;
  const g = low
    ? new THREE.BoxGeometry(1.6, 0.7, 0.8)
    : new THREE.BoxGeometry(1.6, 2.0, 0.8);
  const m = new THREE.MeshStandardMaterial({
    color: low ? 0xffd400 : 0x7a1030,
    emissive: low ? 0x332a00 : 0x2a0010, roughness: 0.5
  });
  const o = new THREE.Mesh(g, m);
  o.userData.low = low;
  o.userData.active = false;
  o.visible = false;
  obstacles.push(o); scene.add(o);
  return o;
}
function newCoin() {
  const c = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0xffd400, emissive: 0x5a4a00, metalness: 0.6, roughness: 0.3 })
  );
  c.rotation.x = Math.PI / 2;
  c.userData.active = false;
  c.visible = false;
  coins.push(c); scene.add(c);
  return c;
}
function getFree(pool, factory) {
  for (const p of pool) if (!p.userData.active) return p;
  return factory();
}

function spawn() {
  const lane = Math.floor(Math.random() * 3);
  const o = getFree(obstacles, newObstacle);
  // reset geometry type occasionally by rebuilding is costly; reuse existing look
  o.userData.active = true; o.visible = true;
  o.position.set(LANES[lane], o.userData.low ? 0.35 : 1.0, SPAWN_Z);

  // coins: a little line in a (often different) lane
  if (Math.random() < 0.8) {
    let clane = Math.floor(Math.random() * 3);
    for (let i = 0; i < 4; i++) {
      const c = getFree(coins, newCoin);
      c.userData.active = true; c.visible = true;
      c.position.set(LANES[clane], 1.0, SPAWN_Z - i * 2.2);
    }
  }
}

/* ---------- input ---------- */
function move(dir) {
  if (!G.running) return;
  G.lane = Math.max(0, Math.min(2, G.lane + dir));
  G.targetX = LANES[G.lane];
}
function jump() {
  if (!G.running || !G.grounded) return;
  G.vy = 9.2; G.grounded = false;
}
function bindInput() {
  window.addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') move(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') move(1);
    else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); jump(); }
  });
  // touch swipe
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
  if (!G.running) { renderer.render(scene, camera); return; }

  // speed & score
  G.speed = Math.min(G.maxSpeed, G.baseSpeed + G.distance * 0.02);
  G.distance += G.speed * dt;
  G.score = Math.floor(G.distance) + G.coins * 25;
  el('hud-score').textContent = G.score.toLocaleString();
  el('hud-coins').textContent = G.coins;

  // player lateral + jump
  player.position.x += (G.targetX - player.position.x) * Math.min(1, dt * 14);
  G.vy -= 26 * dt; G.y += G.vy * dt;
  if (G.y <= 0) { G.y = 0; G.vy = 0; G.grounded = true; }
  player.position.y = G.y;
  player.rotation.z = (G.targetX - player.position.x) * 0.12;

  // run animation
  G.runT += dt * G.speed * 0.6;
  const swing = Math.sin(G.runT) * 0.5;
  if (playerParts.legL) { playerParts.legL.rotation.x = swing; playerParts.legR.rotation.x = -swing; }
  player.position.y = G.y + Math.abs(Math.sin(G.runT)) * 0.06;

  // move decor
  const dz = G.speed * dt;
  dashes.forEach(d => { d.position.z += dz; if (d.position.z > RECYCLE_Z) d.position.z -= 96; });
  pillars.forEach(p => { p.position.z += dz; if (p.position.z > RECYCLE_Z) p.position.z -= 144; });

  // spawn
  G.spawnClock += dt;
  const gap = Math.max(0.55, G.spawnGap - G.distance * 0.0006);
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
    if (Math.abs(c.position.z - PLAYER_Z) < 0.8 &&
        Math.abs(c.position.x - player.position.x) < 0.9 &&
        Math.abs(1.0 - (G.y + 1.0)) < 1.2) {
      c.userData.active = false; c.visible = false; G.coins++;
    }
  }

  renderer.render(scene, camera);
}

/* ---------- states ---------- */
function reset() {
  obstacles.forEach(o => { o.userData.active = false; o.visible = false; });
  coins.forEach(c => { c.userData.active = false; c.visible = false; });
  Object.assign(G, {
    lane: 1, targetX: 0, y: 0, vy: 0, grounded: true,
    speed: G.baseSpeed, distance: 0, score: 0, coins: 0, spawnClock: 0, runT: 0
  });
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
    ? window.SubwayWallet.short(window.SubwayWallet.address)
    : 'You (demo)';

  let rankLine = '';
  try {
    if (window.SubwayLeaderboard) {
      const res = await window.SubwayLeaderboard.submit({ addr, score: G.score, mode: G.mode });
      if (res && res.rank) {
        rankLine = G.mode === 'compete'
          ? `You're #${res.rank} on the leaderboard.`
          : `Local rank #${res.rank} — connect & hold ${window.CONFIG.tokenSymbol} to compete for the pool.`;
      }
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
    const canvas = el('game-canvas');
    makeRenderer(canvas);
    buildScene();
    bindInput();
    clock = new THREE.Clock();
    // warm up a few pooled objects
    for (let i = 0; i < 8; i++) newObstacle();
    for (let i = 0; i < 20; i++) newCoin();
    tick();
  },
  start,
  get running() { return G.running; }
};
