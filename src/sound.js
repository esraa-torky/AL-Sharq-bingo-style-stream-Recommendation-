// Paper sounds, made in the browser with the Web Audio API (no audio files to download or cache).
//   turn():  a page being torn off and turned, played when moving between screens
//   stamp(): a soft dull tap when a square is stamped
// Visitors can switch sound off from the welcome screen; the choice is remembered on that device.

const KEY = 'finder-sound';
let ctx = null;
let noise = null;

export function soundOn() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; }
}
export function setSound(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* not stored */ }
}

// Must be called from a tap or click: browsers only allow audio after a user gesture.
function ready() {
  if (!soundOn()) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    // one second of white noise, reused for every sound
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// One burst of filtered noise with its own envelope.
function burst(c, at, { dur, from, to, q, peak, attack, type = 'bandpass' }) {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const f = c.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(at, Math.random() * 0.5, dur + 0.05);
}

export function turn() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.01;
  // a quick tear, then the sheet's swish as it slides away, with a few paper crinkles
  burst(c, t, { dur: 0.09, from: 4200, to: 2600, q: 1.4, peak: 0.22, attack: 0.006 });
  burst(c, t + 0.05, { dur: 0.38, from: 2400, to: 700, q: 0.7, peak: 0.16, attack: 0.05 });
  for (let i = 0; i < 3; i++) burst(c, t + 0.06 + Math.random() * 0.22, { dur: 0.03, from: 5200, to: 3800, q: 3, peak: 0.07, attack: 0.003 });
}

export function stamp() {
  const c = ready();
  if (!c) return;
  burst(c, c.currentTime + 0.005, { dur: 0.08, from: 900, to: 220, q: 0.9, peak: 0.25, attack: 0.004, type: 'lowpass' });
}
