// The opening screen of the landing page (index.html, #intro): the network gathers.
// Points fly in from every side and join into a ring of linked hubs, gold signals run from each hub to the middle,
// and where they meet a gold ring spreads and the Al Sharq Youth logo appears (the logo's own fade is in site.css,
// so it shows even if this file never runs). On leaving, the hubs fly back out, the screen clears, and the logo
// travels up into its place in the top bar.
const TAU = Math.PI * 2;
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const INK = { line: '236,168,188', hub: '246,176,196', glow: '214,64,104', gold: '241,194,122' };
const GATHER = 1000, MEET = 1150; // ms: when the hubs have arrived, and when the signals reach the middle

export function startIntro(el) {
  const canvas = el.querySelector('canvas'), logo = el.querySelector('img');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, hubs = [], raf = 0, began = performance.now(), leftAt = 0;

  function fit() {
    W = el.clientWidth; H = el.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // Each hub has a far starting place off screen and a resting place on a loose ring around the logo.
  function build() {
    fit();
    const n = W < 600 ? 13 : 19, far = Math.hypot(W, H) * 0.62;
    const rx = Math.min(W * 0.44, 400), ry = Math.min(H * 0.27, 230);
    hubs = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * TAU + (Math.random() - 0.5) * 0.25, from = a + (Math.random() - 0.5) * 1.1, k = 0.82 + Math.random() * 0.36;
      return { a, k, rx: rx * k, ry: ry * k, fx: Math.cos(from) * far, fy: Math.sin(from) * far, big: i % 3 === 0, r: i % 3 === 0 ? 5.5 : 3, wait: (i % 5) * 55, spin: (Math.random() - 0.5) * 0.12 };
    });
  }

  function place(hub, now) {
    const t = now - began, a = hub.a + hub.spin * (t / 1000);
    const hx = Math.cos(a) * hub.rx, hy = Math.sin(a) * hub.ry;
    let k = ease((t - hub.wait) / GATHER);
    if (leftAt) k *= 1 - ease((now - leftAt) / 700); // flying back out
    return [W / 2 + hub.fx + (hx - hub.fx) * k, H / 2 + hub.fy + (hy - hub.fy) * k, k];
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    const t = now - began, cx = W / 2, cy = H / 2;
    ctx.clearRect(0, 0, W, H);
    const at = hubs.map((hub) => place(hub, now));
    // links: each hub to its neighbour and to the one three along, clearer as the hubs settle
    ctx.lineWidth = 1;
    hubs.forEach((hub, i) => {
      for (const step of [1, 3]) {
        const j = (i + step) % hubs.length, o = Math.min(at[i][2], at[j][2]) * (step === 1 ? 0.55 : 0.28);
        if (o < 0.02) continue;
        ctx.strokeStyle = `rgba(${INK.line},${o.toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(at[i][0], at[i][1]); ctx.lineTo(at[j][0], at[j][1]); ctx.stroke();
      }
    });
    // gold signals from every hub to the middle, with a short tail
    hubs.forEach((hub, i) => {
      const s = (t - 620 - hub.wait * 0.6) / (MEET - 620);
      if (s <= 0 || s >= 1 || leftAt) return;
      for (let tail = 3; tail >= 0; tail--) {
        const k = ease(s) - tail * 0.04; if (k < 0) continue;
        ctx.fillStyle = `rgba(${INK.gold},${(1 - tail / 4).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(at[i][0] + (cx - at[i][0]) * k, at[i][1] + (cy - at[i][1]) * k, 2.6 - tail * 0.45, 0, TAU); ctx.fill();
      }
    });
    // where the signals meet: two gold rings spread out behind the logo
    for (const lag of [0, 260]) {
      const k = (t - MEET - lag) / 1100;
      if (k <= 0 || k >= 1) continue;
      ctx.strokeStyle = `rgba(${INK.gold},${((1 - k) * 0.55).toFixed(3)})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(cx, cy, 30 + ease(k) * Math.min(W * 0.46, 420), 18 + ease(k) * Math.min(H * 0.28, 240), 0, 0, TAU); ctx.stroke();
    }
    // the hubs themselves
    hubs.forEach((hub, i) => {
      const [x, y, k] = at[i]; if (k < 0.02) return;
      if (hub.big) { ctx.fillStyle = `rgba(${INK.glow},${(0.22 * k).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, hub.r * 2.6, 0, TAU); ctx.fill(); }
      ctx.fillStyle = `rgba(${INK.hub},${(0.95 * k).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, hub.r, 0, TAU); ctx.fill();
    });
  }

  build();
  window.addEventListener('resize', fit);
  raf = requestAnimationFrame(draw);

  return {
    // Ends the screen. `target` is the logo in the top bar: the big logo shrinks and travels onto it.
    // Resolves when the screen can be taken off the page.
    leave(target) {
      leftAt = performance.now();
      el.classList.add('leave');
      const done = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
      if (!logo.animate) return new Promise((r) => setTimeout(() => { done(); r(); }, 700));
      let frames = [{ opacity: 1 }, { opacity: 0 }];
      if (target) {
        const a = logo.getBoundingClientRect(), b = target.getBoundingClientRect();
        if (a.width && b.width) frames = [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${b.left + b.width / 2 - a.left - a.width / 2}px,${b.top + b.height / 2 - a.top - a.height / 2}px) scale(${b.height / a.height})`, opacity: 1 }];
      }
      return logo.animate(frames, { duration: 850, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' }).finished.then(done, done);
    },
  };
}
