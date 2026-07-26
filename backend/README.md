# Subway Hood — Leaderboard Backend (anti-cheat)

Lightweight Node/Express service that stores scores, resists casual cheating, and
computes **basis-point** prize shares on a **2-day cooldown**. No native deps, no
database server — data is a JSON file. Good for an MVP; swap to Postgres later.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/health` | liveness + player count |
| POST | `/session` | start a run → `{ sessionId, startedAt, signature }` |
| POST | `/scores` | submit a finished run (validated) → `{ accepted, best, rank, total }` |
| GET  | `/scores?limit=N` | top N → `[{ addr, score, mode }]` |
| POST | `/admin/distribute` | compute bps shares (needs `x-admin-key`, 2-day cooldown) |
| GET  | `/distribution/last` | last distribution + next eligible time |
| POST | `/admin/reset` | wipe scores (needs `x-admin-key`) |

### Score submission body
```json
{ "sessionId":"...", "signature":"...", "address":"0x..", "addr":"0x..…",
  "score":12345, "coins":42, "mode":"compete", "durationMs":61000 }
```
The server trusts its **own** session clock, not `durationMs`, to bound the score.

## Anti-cheat (what it does / doesn't)
- **Does:** signed session per run, single-use sessions, server-measured duration,
  max-plausible-score check (`MAX_SPEED`·t + coins·25), coin-rate check, per-IP rate limits.
- **Doesn't:** guarantee integrity. A determined cheater can still script inputs.
  For that, add **replay validation**: have the client send its input events + RNG
  seed, and re-run the deterministic simulation server-side. This backend is
  structured so that becomes a drop-in stricter `/scores` handler.

## Run locally
```bash
cd backend
cp .env.example .env      # then edit secrets
npm install
npm start                 # http://localhost:8090/health
```

## Deploy on a VPS (Ubuntu example)
```bash
# 1) Node 18+ (via nvm or nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2) get the code
git clone https://github.com/golputin/subway.git
cd subway/backend
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # paste into HMAC_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # paste into ADMIN_KEY
nano .env                                                                  # set ALLOWED_ORIGIN too
npm install

# 3) run under pm2 (auto-restart + boot)
sudo npm i -g pm2
pm2 start server.js --name subway-lb
pm2 save && pm2 startup

# 4) reverse proxy + TLS (nginx + certbot) on api.yourdomain.com -> 127.0.0.1:8090
#    proxy_pass http://127.0.0.1:8090;  then: sudo certbot --nginx -d api.yourdomain.com
```

## Wire the frontend
In `config.js` set:
```js
apiBase: "https://api.yourdomain.com"
```
The game already calls `/session` at run start and submits with the session on
game over; the landing reads `/scores` for the live board. No frontend code change needed.

## Trigger a payout calculation
```bash
curl -X POST https://api.yourdomain.com/admin/distribute -H "x-admin-key: YOUR_ADMIN_KEY"
```
Returns each address's `bps` (basis points). Pay out USDT from your treasury
accordingly. Re-running before 48h returns `429 cooldown active`.
