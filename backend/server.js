/*
 * Subway Hood — anti-cheat leaderboard backend.
 * Pure Node + Express (no native deps). JSON-file persistence.
 *
 * Anti-cheat model (heuristic, MVP):
 *   1) Client requests a signed SESSION before a run  (POST /session).
 *   2) On game over the client POSTs the score WITH the session id + signature.
 *   3) Server validates: signature ok, session unused, run duration plausible,
 *      score <= max physically-possible score for that duration, coins plausible,
 *      per-IP rate limits. Only the server-measured session age is trusted.
 *   4) Best score per address is kept.
 *
 * Prize distribution: POST /admin/distribute computes each player's share in
 * BASIS POINTS (bps) pro-rata to points, enforcing a 2-day cooldown. It does
 * NOT move funds — it outputs the allocation for your treasury to pay out.
 *
 * NOTE: heuristics deter casual cheating; they are not bulletproof. For full
 * integrity, add server-side replay validation (send input events + RNG seed
 * and re-simulate the run). See README.
 */
'use strict';
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PORT = +(process.env.PORT || 8090);
const SECRET = process.env.HMAC_SECRET || 'dev-secret-change-me';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const MAX_SPEED = +(process.env.MAX_SPEED || 44);          // must match game.js G.maxSpeed
const COINS_PER_SEC = +(process.env.MAX_COINS_PER_SEC || 6);
const MIN_RUN_MS = +(process.env.MIN_RUN_MS || 3000);
const MAX_RUN_MS = +(process.env.MAX_RUN_MS || 2 * 60 * 60 * 1000);
const COOLDOWN_MS = +(process.env.COOLDOWN_HOURS || 48) * 3600 * 1000;

if (SECRET === 'dev-secret-change-me') console.warn('[warn] HMAC_SECRET is default — set a strong secret in .env');

// ---------- persistence ----------
const DATA = path.join(__dirname, 'data.json');
let db = { scores: {}, distributions: [] }; // scores: id -> { addr, address, best, mode, updatedAt }
try { if (fs.existsSync(DATA)) db = JSON.parse(fs.readFileSync(DATA, 'utf8')); }
catch (e) { console.error('[data] load failed, starting fresh:', e.message); }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(DATA, JSON.stringify(db)); } catch (e) { console.error('[data] save failed:', e.message); }
  }, 250);
}

// ---------- sessions (in-memory) ----------
const sessions = new Map(); // sessionId -> { startedAt, used }
function sign(s) { return crypto.createHmac('sha256', SECRET).update(s).digest('hex'); }

// ---------- naive rate limiting ----------
const hits = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}
function ipOf(req) { return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'ip'; }

// ---------- app ----------
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '16kb' }));
app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN.split(',').map(s => s.trim()) }));

app.get('/health', (req, res) => res.json({ ok: true, players: Object.keys(db.scores).length, uptime: process.uptime() }));

// start a run -> signed session
app.post('/session', (req, res) => {
  const ip = ipOf(req);
  if (rateLimited('sess:' + ip, 40, 60000)) return res.status(429).json({ error: 'slow down' });
  const sessionId = crypto.randomBytes(16).toString('hex');
  const startedAt = Date.now();
  sessions.set(sessionId, { startedAt, used: false });
  if (sessions.size > 20000) for (const [k, v] of sessions) if (Date.now() - v.startedAt > MAX_RUN_MS) sessions.delete(k);
  res.json({ sessionId, startedAt, signature: sign(sessionId + ':' + startedAt) });
});

function maxPlausibleScore(durationMs) {
  const t = durationMs / 1000;
  return MAX_SPEED * t + COINS_PER_SEC * t * 25; // generous upper bound
}

// submit a finished run
app.post('/scores', (req, res) => {
  const ip = ipOf(req);
  if (rateLimited('score:' + ip, 60, 60000)) return res.status(429).json({ error: 'slow down' });

  const { sessionId, signature, address, score, coins = 0, mode = 'practice', addr } = req.body || {};
  const s = Number(score);
  if (!Number.isFinite(s) || s < 0 || s > 5e7) return res.status(400).json({ error: 'bad score' });

  const sess = sessions.get(sessionId);
  if (!sess) return res.status(403).json({ error: 'no/expired session' });
  if (sess.used) return res.status(409).json({ error: 'session already used' });
  if (signature !== sign(sessionId + ':' + sess.startedAt)) return res.status(403).json({ error: 'bad signature' });

  const age = Date.now() - sess.startedAt; // server-trusted duration
  if (age < MIN_RUN_MS || age > MAX_RUN_MS) return res.status(400).json({ error: 'implausible duration' });
  if (s > maxPlausibleScore(age) * 1.1 + 100) return res.status(422).json({ error: 'score exceeds plausible maximum' });
  if (Number(coins) > COINS_PER_SEC * (age / 1000) + 5) return res.status(422).json({ error: 'coin count implausible' });

  sess.used = true; sessions.delete(sessionId);

  const id = String(address || addr || 'anon:' + ip).toLowerCase();
  const cur = db.scores[id];
  if (!cur || s > cur.best) {
    db.scores[id] = { addr: addr || id, address: address || null, best: Math.floor(s), mode, updatedAt: Date.now() };
    save();
  }
  const best = db.scores[id].best;
  const rank = 1 + Object.values(db.scores).filter(x => x.best > best).length;
  res.json({ accepted: true, best, rank, total: Object.keys(db.scores).length });
});

// top N
app.get('/scores', (req, res) => {
  const limit = Math.min(1000, Math.max(1, +(req.query.limit || 10)));
  const rows = Object.values(db.scores).sort((a, b) => b.best - a.best).slice(0, limit)
    .map(r => ({ addr: r.addr, score: r.best, mode: r.mode }));
  res.json(rows);
});

// compute basis-point prize shares (2-day cooldown). Does NOT move funds.
app.post('/admin/distribute', (req, res) => {
  if (!ADMIN_KEY || req.headers['x-admin-key'] !== ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
  const last = db.distributions[db.distributions.length - 1];
  if (last && Date.now() - last.ranAt < COOLDOWN_MS)
    return res.status(429).json({ error: 'cooldown active', nextEligibleAt: last.ranAt + COOLDOWN_MS });

  const eligible = Object.values(db.scores).filter(x => x.mode === 'compete' && x.best > 0);
  const total = eligible.reduce((a, x) => a + x.best, 0);
  if (total <= 0) return res.status(400).json({ error: 'no eligible points' });

  const allocations = eligible
    .map(x => ({ addr: x.addr, address: x.address, points: x.best, bps: Math.floor((x.best / total) * 10000) }))
    .sort((a, b) => b.points - a.points);
  const dist = { id: crypto.randomBytes(8).toString('hex'), ranAt: Date.now(), totalPoints: total, count: allocations.length, allocations };
  db.distributions.push(dist); save();
  res.json({ ok: true, distribution: dist, note: 'basis points computed — execute the actual USDT payouts from your treasury' });
});

app.get('/distribution/last', (req, res) => {
  const last = db.distributions[db.distributions.length - 1] || null;
  res.json({ last, cooldownMs: COOLDOWN_MS, nextEligibleAt: last ? last.ranAt + COOLDOWN_MS : Date.now() });
});

// optional: reset the board (admin only)
app.post('/admin/reset', (req, res) => {
  if (!ADMIN_KEY || req.headers['x-admin-key'] !== ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
  db.scores = {}; save(); res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Subway Hood leaderboard listening on :${PORT}`));
