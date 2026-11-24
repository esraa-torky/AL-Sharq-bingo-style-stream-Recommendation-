// Torn-paper helpers: jagged torn edges (clip-path) with a light "rim" behind each torn piece,
// stacked paper sheets, paper buttons and stamp dots. Ported from the approved design samples.
let seedN = 7;
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* torn paper: fine jagged teeth on torn sides, clean straight sides elsewhere.
     Each torn piece gets a light "rim" layer behind it, so the paper core shows along the tear. */
  function tearSide(R, scale) {
    var n = 30, rim = [], inner = []; // 30 teeth per torn side: jagged enough to read as torn, light enough for slower phones
    for (var i = 0; i <= n; i++) {
      var pos = i === 0 ? 0 : i === n ? 100 : Math.min(100, Math.max(0, i * 100 / n + (R() - .5) * 0.9));
      var bite = R() < 0.06 ? 2 + R() * 3 : 0;
      var r = (0.3 + R() * 2.2 + bite * 0.6) * scale;
      var w = (1.8 + R() * 3) * scale;
      rim.push([pos, r]); inner.push([pos, r + w + bite * 0.4]);
    }
    return { rim: rim, inner: inner };
  }
  function edgePolygon(sides, key) {
    var pts = [];
    function px(v) { return v.toFixed(2) + 'px'; }
    function side(name, list, map) { if (list) list.forEach(function (p) { pts.push(map(p[0], p[1])); }); else pts.push(map(0, 0), map(100, 0)); }
    side('t', sides.t && sides.t[key], function (q, d) { return 'calc(' + q.toFixed(2) + '%) ' + px(d); });
    side('r', sides.r && sides.r[key], function (q, d) { return 'calc(100% - ' + px(d) + ') ' + q.toFixed(2) + '%'; });
    side('b', sides.b && sides.b[key], function (q, d) { return (100 - q).toFixed(2) + '% calc(100% - ' + px(d) + ')'; });
    side('l', sides.l && sides.l[key], function (q, d) { return px(d) + ' ' + (100 - q).toFixed(2) + '%'; });
    return 'polygon(' + pts.join(',') + ')';
  }
  function deckle(node, amp, which) {
    var R = rng(seedN += 13), scale = Math.max(.55, Math.min(1.2, (amp || 1.5) / 2)), torn = typeof which === 'string' ? which : 'trbl', sides = {};
    'trbl'.split('').forEach(function (k) { if (torn.indexOf(k) > -1) sides[k] = tearSide(R, scale); });
    node.style.clipPath = edgePolygon(sides, 'inner');
    if (!node.classList.contains('tile')) node._rim = edgePolygon(sides, 'rim');
    return node;
  }
  /* after a sample is drawn, put a rim layer behind every torn piece */
  function addRims(root) {
    // read every position first, then make all the changes: one style check instead of one per torn piece
    var torn = Array.prototype.filter.call(root.querySelectorAll('*'), function (n) { return n._rim && !n._rimDone && n.parentNode; });
    var plan = torn.map(function (n) { return [n, getComputedStyle(n.parentNode).position === 'static', getComputedStyle(n).position === 'static']; });
    plan.forEach(function (x) {
      var n = x[0], par = n.parentNode, rim = document.createElement('span');
      rim.className = 'rim'; rim.style.clipPath = n._rim; rim.setAttribute('aria-hidden', 'true');
      if (x[1]) par.style.position = 'relative';
      if (x[2]) n.style.position = 'relative';
      par.insertBefore(rim, n); n._rimDone = true;
    });
  }
  function h(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function logos() { return '<img class="logo for-light" alt="Al Sharq Youth" src="assets/logo-light.png"><img class="logo for-dark" alt="Al Sharq Youth" src="assets/logo-dark.png">'; }
  function labelBtn(text) { var w = h('div', 'label-wrap'), b = h('button', 'label-btn', '<span>' + text + '</span>' + ARROW); b.type = 'button'; deckle(b, 1.6, 'r'); w.appendChild(b); return w; }

  /* a phone = stacked paper sheets */
  function phone(extraNext) {
    var p = h('div', 'phone');
    ['b2', 'b1'].forEach(function (k) { var l = h('div', 'layer ' + k), s = h('div', 'sheet grain'); deckle(s, 2.6, 'trbl'); l.appendChild(s); p.appendChild(l); });
    if (extraNext) { var ln = h('div', 'layer next'), sn = h('div', 'sheet grain'); deckle(sn, 2.2, 'rb'); sn.appendChild(h('div', 'content')); ln.appendChild(sn); p.appendChild(ln); }
    var lt = h('div', 'layer top'), st = h('div', 'sheet grain'); deckle(st, 2.2, 'rb');
    var c = h('div', 'content'); st.appendChild(c); lt.appendChild(st); p.appendChild(lt);
    p.top = st; p.c = c; p.next = extraNext ? p.querySelector('.layer.next .content') : null;
    return p;
  }
  function strip(pct) {
    var t = h('div', 'strip-track'), w = h('div', 'strip-wrap'), s = h('div', 'strip'); deckle(s, 1.1, 'r'); w.style.width = pct + '%'; w.appendChild(s); t.appendChild(w); return t;
  }
  function papered(cls, wrapCls, html, amp) { var w = h('div', wrapCls), n = h('div', cls, html); deckle(n, amp || 1.4, 'trbl'); w.appendChild(n); return w; }

  function dot(color, pop) { var d = h('span', 'dot' + (pop ? ' pop' : '')), i = h('i'); i.style.color = color; d.appendChild(i); return d; }
export { rng, deckle, addRims, h, ARROW, logos, labelBtn, phone, papered, dot };
