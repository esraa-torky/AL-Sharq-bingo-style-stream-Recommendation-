// Page curl: the bottom corner of the old page peels up and folds back diagonally, like the corner of a
// paper page being lifted, until the whole page is off and the next page shows underneath.
//
// How it works: the lifted corner C is pulled towards a point T. The fold line is the line halfway between
// C and T (every point on it is the same distance from both). The part of the page on T's side stays flat;
// the part on C's side is mirrored across the fold line and drawn as the back of the paper (the "flap").

const EASE = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // ease in and out

// Keep the part of a polygon on one side of a line: points x with dot(x - m, n) <= 0.
function clip(poly, m, n) {
  const out = [];
  const side = (p) => (p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa <= 0) !== (sb <= 0)) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
const poly = (pts) => (pts.length < 3 ? 'polygon(0 0,0 0,0 0)' : 'polygon(' + pts.map((p) => p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px').join(',') + ')');

/**
 * Animate a curl on `stage` (an element already holding the old page and the back of the paper).
 *   flat:  wrapper of the old page that stays flat (clipped)
 *   flap:  the back of the paper, mirrored across the fold
 *   shine: the light and shade across the curl, on top of the flap
 * fromLeft: peel the bottom-left corner (Arabic) instead of the bottom-right.
 */
export function curl({ stage, flat, flap, shine, fromLeft, ms, done }) {
  const W = stage.clientWidth, H = stage.clientHeight;
  const rect = [[0, 0], [W, 0], [W, H], [0, H]];
  const C = fromLeft ? [0, H] : [W, H];
  // pull the corner up and across, a little further than the opposite top corner so the whole page lifts
  const far = fromLeft ? [W, 0] : [0, 0];
  const T1 = [C[0] + (far[0] - C[0]) * 2.15, C[1] + (far[1] - C[1]) * 2.35];
  const start = performance.now();

  function frame() {
    const t = Math.min(1, (performance.now() - start) / ms), e = EASE(t);
    // a slight upward bow early on gives the corner a curl rather than a straight slide
    const bow = Math.sin(Math.PI * e) * 0.08;
    const T = [C[0] + (T1[0] - C[0]) * e + (fromLeft ? -1 : 1) * bow * W * 0.3, C[1] + (T1[1] - C[1]) * e - bow * H * 0.2];
    const d = [C[0] - T[0], C[1] - T[1]], len = Math.hypot(d[0], d[1]) || 1;
    const n = [d[0] / len, d[1] / len];                 // fold normal, pointing to the lifted corner
    const m = [(C[0] + T[0]) / 2, (C[1] + T[1]) / 2];   // a point on the fold line
    flat.style.clipPath = poly(clip(rect, m, n));
    const lifted = clip(rect, m, [-n[0], -n[1]]);       // the part being folded back, before mirroring
    flap.style.clipPath = poly(lifted);
    shine.style.clipPath = flap.style.clipPath;
    // mirror across the fold line: x' = x - 2 * dot(x - m, n) * n
    const a = 1 - 2 * n[0] * n[0], b = -2 * n[0] * n[1], dd = 1 - 2 * n[1] * n[1];
    const k = 2 * (m[0] * n[0] + m[1] * n[1]);
    const mtx = `matrix(${a},${b},${b},${dd},${(k * n[0]).toFixed(2)},${(k * n[1]).toFixed(2)})`;
    flap.style.transform = mtx;
    shine.style.transform = mtx;
    // light along the fold, shade towards the lifted corner (in the flap's own, unmirrored coordinates)
    const ang = Math.atan2(n[0], -n[1]) * 180 / Math.PI;
    const L = Math.abs(W * Math.sin(ang * Math.PI / 180)) + Math.abs(H * Math.cos(ang * Math.PI / 180));
    const at = (p) => (((p[0] - W / 2) * n[0] + (p[1] - H / 2) * n[1]) / L + 0.5) * 100;
    const f = at(m), c = Math.max(f + 1, at(C));
    shine.style.background = `linear-gradient(${ang.toFixed(1)}deg, rgba(40,10,20,0) ${(f - 0.5).toFixed(1)}%, rgba(255,255,255,.55) ${f.toFixed(1)}%, rgba(255,255,255,0) ${(f + (c - f) * 0.3).toFixed(1)}%, rgba(40,10,20,.16) ${c.toFixed(1)}%)`;
    if (t < 1) requestAnimationFrame(frame); else done();
  }
  requestAnimationFrame(frame);
}
