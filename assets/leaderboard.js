/*
 * Subway Hood — leaderboard.
 * If CONFIG.apiBase is set, uses a REST backend (GET /scores, POST /scores).
 * Otherwise falls back to a LOCAL browser leaderboard (simulation for now).
 * Expose window.SubwayLeaderboard.
 */
(function () {
  const C = window.CONFIG || {};
  const KEY = "sh_leaderboard";

  // seed a few fake entries so the board never looks empty in the demo
  const SEED = [
    { addr: "0x9F2a…c1D4", score: 48210, mode: "compete" },
    { addr: "0x3Ab7…88Fe", score: 41560, mode: "compete" },
    { addr: "0x77c0…2b19", score: 38975, mode: "compete" },
    { addr: "0xE41d…9a02", score: 30110, mode: "compete" },
    { addr: "0x0d5B…7Cc3", score: 25640, mode: "demo" }
  ];

  function localGet() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return SEED.slice();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) && arr.length ? arr : SEED.slice();
    } catch (e) { return SEED.slice(); }
  }
  function localSave(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100))); } catch (e) {}
  }

  async function getTop(n = 10) {
    if (C.apiBase) {
      try {
        const r = await fetch(C.apiBase.replace(/\/$/, "") + "/scores?limit=" + n);
        if (r.ok) return await r.json();
      } catch (e) { console.warn("lb api failed, using local", e); }
    }
    return localGet().sort((a, b) => b.score - a.score).slice(0, n);
  }

  async function submit(entry) {
    // entry: { addr, score, mode }
    if (C.apiBase) {
      try {
        const r = await fetch(C.apiBase.replace(/\/$/, "") + "/scores", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry)
        });
        if (r.ok) return await r.json();
      } catch (e) { console.warn("lb submit failed, using local", e); }
    }
    const list = localGet();
    const label = entry.addr || "Anon";
    const existing = list.find(x => x.addr === label);
    if (existing) { if (entry.score > existing.score) existing.score = entry.score; existing.mode = entry.mode; }
    else list.push({ addr: label, score: entry.score, mode: entry.mode });
    list.sort((a, b) => b.score - a.score);
    localSave(list);
    const rank = list.findIndex(x => x.addr === label) + 1;
    return { rank, total: list.length };
  }

  window.SubwayLeaderboard = { getTop, submit };
})();
