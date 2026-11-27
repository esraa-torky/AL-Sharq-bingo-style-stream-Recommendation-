// The living web behind the landing page headline: people (small points) and hubs (larger points) drift slowly,
// lines join whoever is close, and gold signals travel from hub to hub. Near a mouse pointer the web leans in and
// links to it. Drawn on one canvas that fills its section. It rests while off screen or in a background tab,
// and shows a single still frame for visitors who ask their device for less motion.
// createWeb() is the full web for the hero; createWeb({ density: 0.9, interactive: false }) is the echo behind
// the dark bands further down the page, which the stylesheet shows fainter.
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// Colours as "r,g,b" so each stroke can set its own opacity. The hero is dark in both themes.
const INK = { line: '236,168,188', point: '255,226,233', hub: '246,176,196', glow: '214,64,104', gold: '241,194,122' };

export function createWeb({ density = 1, interactive = true, className = 'hero-web' } = {}) {
  const el = document.createElement('div');
  el.className = className;
  el.setAttribute('aria-hidden', 'true'); // decoration, unless label() gives it a description
  const canvas = document.createElement('canvas');
  el.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const light = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.connection && navigator.connection.saveData);

  let W = 0, H = 0, reach = 150, nodes = [], signals = [], ripples = [];
  let raf = 0, last = 0, onScreen = true, frames = 0;
  const pointer = { x: 0, y: 0, inside: false, k: 0 };

  function makeNode(hub) {
    const z = hub ? rand(0.8, 1) : rand(0.35, 1); // depth: far points are smaller, fainter and slower
    const a = rand(0, TAU), v = (hub ? rand(3, 7) : rand(6, 16)) * z;
    // of a few random places, take the one farthest from the points already there: an even spread without a grid
    let x = 0, y = 0, far = -1;
    for (let k = 0; k < 6; k++) {
      const cx = rand(0, W), cy = rand(0, H);
      let near = Infinity;
      for (const n of nodes) near = Math.min(near, (n.x - cx) ** 2 + (n.y - cy) ** 2);
      if (near > far) { far = near; x = cx; y = cy; }
    }
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, turn: rand(-0.12, 0.12), z, hub, r: hub ? rand(4.4, 7.4) : rand(1.5, 3) * z, phase: rand(0, TAU), ox: 0, oy: 0 };
  }

  function makeSignal() {
    const hubs = nodes.filter((n) => n.hub);
    const from = hubs[Math.floor(Math.random() * hubs.length)] || nodes[0];
    return { from, to: nextStop(from), t: 0, speed: rand(70, 120), fade: 0 };
  }

  // The next point a signal runs to: a neighbour in reach, hubs preferred, never straight back.
  function nextStop(from, not) {
    let best = null, score = -1;
    for (const n of nodes) {
      if (n === from || n === not) continue;
      const d = Math.hypot(n.x - from.x, n.y - from.y);
      if (d > reach * 0.95) continue;
      const s = Math.random() * (n.hub ? 2.2 : 1) * n.z;
      if (s > score) { score = s; best = n; }
    }
    return best;
  }

  // Sizes the canvas to the hero. Existing points keep their place in proportion, so a resize does not reshuffle the web.
  function fit() {
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const sx = W ? box.width / W : 1, sy = H ? box.height / H : 1;
    W = box.width; H = box.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    reach = clamp(Math.sqrt(W * H) / 6, 124, 210);
    const want = Math.round(clamp((W * H) / 13500, 26, 110) * density * (light ? 0.6 : 1));
    nodes.forEach((n) => { n.x *= sx; n.y *= sy; });
    while (nodes.length > want) nodes.pop();
    while (nodes.length < want) nodes.push(makeNode(nodes.length % 8 === 0));
    const wantSignals = clamp(Math.round(want / 8), 3, 11);
    signals = signals.filter((s) => nodes.includes(s.from) && nodes.includes(s.to)).slice(0, wantSignals);
    while (signals.length < wantSignals) signals.push(makeSignal());
    if (still.matches) draw();
  }

  function step(dt) {
    pointer.k += ((pointer.inside ? 1 : 0) - pointer.k) * Math.min(1, dt * 4);
    const pad = 24;
    for (const n of nodes) {
      // wander: the heading turns a little all the time, so paths curve instead of running straight
      const c = Math.cos(n.turn * dt), s = Math.sin(n.turn * dt), vx = n.vx;
      n.vx = vx * c - n.vy * s; n.vy = vx * s + n.vy * c;
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < -pad && n.vx < 0) n.vx = -n.vx; else if (n.x > W + pad && n.vx > 0) n.vx = -n.vx;
      if (n.y < -pad && n.vy < 0) n.vy = -n.vy; else if (n.y > H + pad && n.vy > 0) n.vy = -n.vy;
      // lean towards the pointer
      let tx = 0, ty = 0;
      if (pointer.k > 0.01) {
        const dx = pointer.x - n.x, dy = pointer.y - n.y, d = Math.hypot(dx, dy), pull = reach * 1.5;
        if (d < pull) { const f = (1 - d / pull) * 0.16 * pointer.k * n.z; tx = dx * f; ty = dy * f; }
      }
      n.ox += (tx - n.ox) * Math.min(1, dt * 5); n.oy += (ty - n.oy) * Math.min(1, dt * 5);
    }
    for (const g of signals) {
      if (!g.to) { Object.assign(g, makeSignal()); continue; }
      const d = Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y);
      if (d > reach * 1.25) g.fade = Math.min(1, g.fade + dt * 3); // the link broke under it: fade out, start again
      g.t += (g.speed * dt) / Math.max(d, 1);
      if (g.fade >= 1) Object.assign(g, makeSignal());
      else if (g.t >= 1) {
        if (g.to.hub) ripples.push({ n: g.to, age: 0 });
        const from = g.to;
        g.to = nextStop(from, g.from); g.from = from; g.t = 0;
      }
    }
    ripples.forEach((r) => { r.age += dt; });
    ripples = ripples.filter((r) => r.age < 1.4);
  }

  function draw(time = 0) {
    ctx.clearRect(0, 0, W, H);
    const px = (n) => n.x + n.ox, py = (n) => n.y + n.oy;
    // lines between points in reach: the closer, the clearer
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y;
        if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue;
        const d = Math.hypot(dx, dy);
        if (d >= reach) continue;
        const o = Math.pow(1 - d / reach, 1.15) * 0.8 * (0.4 + 0.6 * Math.min(a.z, b.z));
        ctx.strokeStyle = `rgba(${INK.line},${o.toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(px(a), py(a)); ctx.lineTo(px(b), py(b)); ctx.stroke();
      }
    }
    // gold links from the pointer to the points around it
    if (pointer.k > 0.01) {
      const span = reach * 1.25;
      for (const n of nodes) {
        const d = Math.hypot(pointer.x - px(n), pointer.y - py(n));
        if (d >= span) continue;
        ctx.strokeStyle = `rgba(${INK.gold},${((1 - d / span) * 0.6 * pointer.k).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(pointer.x, pointer.y); ctx.lineTo(px(n), py(n)); ctx.stroke();
      }
    }
    // rings that spread from a hub when a signal lands
    for (const r of ripples) {
      const k = r.age / 1.4;
      ctx.strokeStyle = `rgba(${INK.gold},${((1 - k) * 0.5).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(px(r.n), py(r.n), r.n.r + 4 + k * 26, 0, TAU); ctx.stroke();
    }
    // points and hubs
    for (const n of nodes) {
      const x = px(n), y = py(n);
      if (n.hub) {
        const breath = 1 + Math.sin(time / 1400 + n.phase) * 0.08;
        ctx.fillStyle = `rgba(${INK.glow},0.16)`; ctx.beginPath(); ctx.arc(x, y, n.r * 3.1 * breath, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(${INK.glow},0.3)`; ctx.beginPath(); ctx.arc(x, y, n.r * 1.9 * breath, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(${INK.hub},0.96)`; ctx.beginPath(); ctx.arc(x, y, n.r, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(${INK.point},${(0.3 + n.z * 0.55).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, n.r, 0, TAU); ctx.fill();
      }
    }
    // signals: a bright gold head with a short fading tail
    for (const g of signals) {
      if (!g.to) continue;
      const o = 1 - g.fade;
      for (let k = 4; k >= 0; k--) {
        const t = g.t - k * 0.035; if (t < 0) continue;
        const x = px(g.from) + (px(g.to) - px(g.from)) * t, y = py(g.from) + (py(g.to) - py(g.from)) * t;
        if (k === 0) { ctx.fillStyle = `rgba(${INK.gold},${(0.22 * o).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); }
        ctx.fillStyle = `rgba(${INK.gold},${((1 - k / 5) * o).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 2.6 - k * 0.4, 0, TAU); ctx.fill();
      }
    }
  }

  function frame(time) {
    raf = 0;
    const dt = Math.min((time - (last || time)) / 1000, 0.05);
    last = time;
    step(dt); draw(time); frames++;
    raf = requestAnimationFrame(frame);
  }
  // Starts the movement unless it is already running or should rest; time starts fresh so a pause never causes a jump.
  function run() {
    if (raf || still.matches || !onScreen || document.hidden || !W) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function pause() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  // Is any of the web inside the screen? Measured directly whenever the page scrolls or the web changes size,
  // which is exact in every browser and both text directions.
  function look() {
    const box = el.getBoundingClientRect();
    onScreen = box.width > 0 && box.bottom > 0 && box.top < window.innerHeight;
    if (onScreen) run(); else pause();
  }
  new ResizeObserver(() => { fit(); look(); }).observe(el);
  window.addEventListener('scroll', look, { passive: true });
  window.addEventListener('resize', look, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else run(); });
  still.addEventListener?.('change', () => { if (still.matches) { pause(); draw(); } else run(); });
  if (interactive) window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const box = canvas.getBoundingClientRect();
    pointer.x = e.clientX - box.left; pointer.y = e.clientY - box.top;
    pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= box.width && pointer.y <= box.height;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.inside = false; });

  return { el, label(text) { el.removeAttribute('aria-hidden'); el.setAttribute('role', 'img'); el.setAttribute('aria-label', text); }, get frames() { return frames; } };
}
