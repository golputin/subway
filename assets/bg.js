/*
 * Subway Hood — lightweight animated backdrop for the landing page.
 * Pure 2D canvas (no WebGL): neon rain + a faint moving perspective grid.
 * Cheap enough to leave running behind the whole page.
 */
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, drops = [], reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    w = canvas.width = innerWidth;
    h = canvas.height = innerHeight;
    const count = Math.min(180, Math.floor(w / 9));
    drops = Array.from({ length: count }, () => spawn());
  }
  function spawn() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      len: 60 + Math.random() * 120,
      spd: 500 + Math.random() * 900,
      hue: Math.random() < 0.5 ? 186 : 330, // cyan / magenta
      a: 0.05 + Math.random() * 0.22
    };
  }

  let last = performance.now(), gridOff = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    ctx.clearRect(0, 0, w, h);

    // faint perspective grid near the bottom
    gridOff = (gridOff + dt * 60) % 48;
    ctx.strokeStyle = 'rgba(120,140,255,0.05)';
    ctx.lineWidth = 1;
    const horizon = h * 0.62;
    for (let i = 0; i < 14; i++) {
      const y = horizon + Math.pow(i / 14, 2) * (h - horizon) + gridOff * (i / 14);
      if (y > h) continue;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let x = -6; x <= 6; x++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + x * 26, horizon);
      ctx.lineTo(w / 2 + x * (w / 9), h);
      ctx.stroke();
    }

    // neon rain
    for (const d of drops) {
      d.y += d.spd * dt;
      if (d.y - d.len > h) { Object.assign(d, spawn(), { y: -d.len }); }
      const g = ctx.createLinearGradient(d.x, d.y - d.len, d.x, d.y);
      g.addColorStop(0, `hsla(${d.hue},100%,65%,0)`);
      g.addColorStop(1, `hsla(${d.hue},100%,65%,${d.a})`);
      ctx.strokeStyle = g; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(d.x, d.y - d.len); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  resize();
  if (!reduce) requestAnimationFrame(frame);
})();
