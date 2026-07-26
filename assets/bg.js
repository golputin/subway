/*
 * Subway Hood — premium dark backdrop: slow-drifting gold dust/embers.
 * Pure 2D canvas, very light.
 */
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, dust = [], reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function spawn() {
    return {
      x: Math.random() * w, y: Math.random() * h,
      r: 0.6 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 8, vy: -6 - Math.random() * 14,
      a: 0.15 + Math.random() * 0.45,
      hue: Math.random() < 0.7 ? 42 : 8 // gold / ember-red
    };
  }
  function resize() {
    w = canvas.width = innerWidth; h = canvas.height = innerHeight;
    dust = Array.from({ length: Math.min(90, Math.floor(w / 18)) }, spawn);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    ctx.clearRect(0, 0, w, h);
    for (const p of dust) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y < -10 || p.x < -10 || p.x > w + 10) { Object.assign(p, spawn(), { y: h + 8 }); }
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue},90%,60%,${p.a})`;
      ctx.shadowColor = `hsla(${p.hue},90%,60%,${p.a})`; ctx.shadowBlur = 8;
      ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.shadowBlur = 0;
    requestAnimationFrame(frame);
  }
  addEventListener('resize', resize);
  resize();
  if (!reduce) requestAnimationFrame(frame);
})();
