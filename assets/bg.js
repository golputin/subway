/*
 * Subway Hood — daytime backdrop for the landing page.
 * Pure 2D canvas: slow drifting clouds + a soft city skyline silhouette.
 * Light, matches the in-game GTA-ish daytime look.
 */
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, clouds = [], skyline = [], reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    w = canvas.width = innerWidth;
    h = canvas.height = innerHeight;
    clouds = Array.from({ length: 7 }, () => ({
      x: Math.random() * w, y: 40 + Math.random() * (h * 0.35),
      s: 40 + Math.random() * 70, spd: 6 + Math.random() * 12, o: 0.5 + Math.random() * 0.4
    }));
    // skyline blocks along the bottom
    skyline = [];
    let x = -40;
    while (x < w + 40) {
      const bw = 40 + Math.random() * 80;
      const bh = 60 + Math.random() * 190;
      skyline.push({ x, w: bw, h: bh });
      x += bw + 6 + Math.random() * 10;
    }
  }

  function cloud(c) {
    ctx.fillStyle = `rgba(255,255,255,${c.o})`;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(c.x + (i - 3) * c.s * 0.5, c.y + Math.sin(i * 1.3) * c.s * 0.16,
        c.s * (0.5 + (i % 3) * 0.16), c.s * 0.4, 0, 0, 7);
      ctx.fill();
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    ctx.clearRect(0, 0, w, h);

    // clouds
    for (const c of clouds) {
      c.x += c.spd * dt;
      if (c.x - c.s * 2 > w) { c.x = -c.s * 2; c.y = 40 + Math.random() * (h * 0.35); }
      cloud(c);
    }

    // skyline silhouette (static, hazy blue) fading into the page
    const baseY = h;
    for (const b of skyline) {
      const g = ctx.createLinearGradient(0, baseY - b.h, 0, baseY);
      g.addColorStop(0, 'rgba(150,178,200,0.30)');
      g.addColorStop(1, 'rgba(150,178,200,0.06)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x, baseY - b.h, b.w, b.h);
      // a few windows
      ctx.fillStyle = 'rgba(120,150,180,0.18)';
      for (let wy = baseY - b.h + 12; wy < baseY - 12; wy += 18)
        for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 16)
          if (Math.random() < 0.5) ctx.fillRect(wx, wy, 7, 10);
    }
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  resize();
  if (reduce) { let n = performance.now(); frame(n); } else requestAnimationFrame(frame);
})();
