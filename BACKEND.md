# COMMAND FOR HERMES — Deploy the Subway Hood leaderboard backend

**Goal:** stand up the anti-cheat leaderboard API (in `backend/` of the repo
`https://github.com/golputin/subway`) on the VPS, behind HTTPS, running 24/7.

**Context:** Node/Express service, no database server (JSON-file store), pure-JS
deps only. It issues signed per-run sessions, validates score plausibility, and
computes basis-point prize shares on a 48-hour cooldown. Full details in
`backend/README.md`.

---

## Do this on the VPS

```bash
# 0) prerequisites: Node.js 18+ and git
node -v || (curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs)
sudo apt-get install -y git nginx

# 1) fetch the code
cd /opt && sudo git clone https://github.com/golputin/subway.git && sudo chown -R $USER:$USER subway
cd /opt/subway/backend

# 2) configure secrets
cp .env.example .env
HMAC=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ADMIN=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
sed -i "s/^HMAC_SECRET=.*/HMAC_SECRET=$HMAC/" .env
sed -i "s/^ADMIN_KEY=.*/ADMIN_KEY=$ADMIN/" .env
sed -i "s#^ALLOWED_ORIGIN=.*#ALLOWED_ORIGIN=https://golputin.github.io#" .env
echo "ADMIN_KEY=$ADMIN"   # <-- SAVE THIS, needed to trigger payouts

# 3) install + run under pm2
npm install
sudo npm i -g pm2
pm2 start server.js --name subway-lb
pm2 save && pm2 startup   # run the command it prints

# 4) reverse proxy + TLS  (replace api.YOURDOMAIN with a real subdomain -> this VPS IP)
sudo tee /etc/nginx/sites-available/subway-lb >/dev/null <<'NGINX'
server {
  listen 80;
  server_name api.YOURDOMAIN;
  location / { proxy_pass http://127.0.0.1:8090; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/subway-lb /etc/nginx/sites-enabled/subway-lb
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.YOURDOMAIN --non-interactive --agree-tos -m you@email.com

# 5) verify
curl -s https://api.YOURDOMAIN/health
```

## Report back to the owner (Moden)
1. The public API base URL: `https://api.YOURDOMAIN`
2. The generated `ADMIN_KEY` (store it privately).

## Owner follow-up (not Hermes)
- Put the API URL into the game's `config.js` → `apiBase: "https://api.YOURDOMAIN"`, commit & push.
- Trigger a payout calc after each cycle:
  `curl -X POST https://api.YOURDOMAIN/admin/distribute -H "x-admin-key: <ADMIN_KEY>"`
  → returns each address's basis points; pay USDT from the treasury. 48h cooldown enforced.

## Guardrails
- Do **not** commit the `.env` (it's git-ignored).
- Do **not** run any real fund transfers — this service only computes shares.
- Keep `ALLOWED_ORIGIN` locked to the real site origin (no `*` in production).
