# 🔹 Subway Hood

A lightweight **Web3 endless runner** inspired by Subway Surfers. Run the underground tunnels, dodge and jump, collect coins, and climb the leaderboard to earn from a **USDT prize pool**. No token? A free **demo mode** lets anyone try it.

Built with plain HTML/CSS/JS + **Three.js** (via CDN) and **ethers.js** for wallet connection. No build step, no framework — just open it in a browser.

## ✨ Features

- **3D endless runner** — 3 lanes, switch to dodge, jump to clear low blocks, grab coins. Speed ramps up.
- **Connect Wallet** — links a player's on-chain address as their profile (MetaMask / injected wallets).
- **Token gating** — hold ≥ a configured amount of the project token to unlock **Compete** mode.
- **Demo mode** — no wallet / not enough token? Play free; scores are marked demo (not pool-eligible).
- **Leaderboard** — top scores; local/simulated store now, swappable for a real backend.
- **Prize pool display** — e.g. `2,000 USDT` split across the top `5,000` of the leaderboard.
- Responsive + mobile swipe controls.

## 🎮 Controls

| Action | Keys | Mobile |
|---|---|---|
| Switch lane | ◀ / ▶ or A / D | swipe left/right |
| Jump | Space / ▲ / W | swipe up |

## 🚀 Run locally

Just open `index.html` in a browser. (For wallet/module features, serving over http is best.)

```bash
# any static server, e.g.
npx serve .
# or
python -m http.server 8080
```

## ⚙️ Configuration — `config.js`

Everything tunable lives in one file. Fill these in when your token + backend are ready:

| Field | Meaning |
|---|---|
| `prizePool`, `leaderboardSlots` | Display copy for the pool section |
| `chainId`, `chainName` | Network players must be on (56 = BNB Chain, etc.) |
| `tokenAddress` | ERC-20 token address for gating (empty = gating off, demo only) |
| `tokenSymbol`, `tokenDecimals`, `minHold` | Token identity + minimum to compete |
| `apiBase` | Leaderboard backend base URL (empty = local/simulated store) |

## 🌐 Deploy on GitHub Pages

1. Push to GitHub (already set up).
2. Repo → **Settings → Pages**.
3. **Source:** *Deploy from a branch* → Branch: `main` (or `master`) → `/root` → **Save**.
4. Wait ~1 min, your game is live at `https://<user>.github.io/<repo>/`.

## 🛣️ Roadmap to "real"

This repo is a complete, playable **frontend MVP**. To make the money side real you'll still need:

- **A deployed token** — put its contract address in `config.js`.
- **A backend + database** — persistent, anti-cheat leaderboard (validate scores server-side; never trust the client for payouts). Point `apiBase` at it.
- **Payout mechanism** — a treasury/smart contract or manual distribution to the top of the leaderboard.
- **Legal/compliance review** — prize pools + token requirements can be regulated depending on jurisdiction.

> ⚠️ Until a verified backend exists, scores are stored in the browser and are **not** a source of truth for real rewards.

---

Made with 🔹 by Claude for Moden.
