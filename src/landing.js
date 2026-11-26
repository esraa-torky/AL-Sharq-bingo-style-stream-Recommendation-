// Landing page (index.html): Al Sharq Youth hero with the moving network, who we are, the path to impact,
// the three support streams, "Your journey starts here" (each card opens its form on form.html),
// and "Take the next step" with the Program Finder test. All text comes from content/landing.<lang>.json.
import { h, ARROW, loadSite, applyLang, href, topbar, footer, registerWorker } from './site.js';

const page = document.getElementById('page');
let site, lang;

function render() {
  const { config, forms, texts } = site, t = texts[lang];
  applyLang(config, t, lang);
  document.title = t.meta.title;
  page.innerHTML = '';
  page.appendChild(topbar(config, t, lang, (l) => { lang = l; render(); }));
  const main = h('main'); main.id = 'main';

  // hero
  const hero = h('section', 'hero'); hero.setAttribute('aria-labelledby', 'hero-title');
  const copy = h('div', 'hero-copy');
  copy.appendChild(h('p', 'eyebrow', t.hero.eyebrow));
  const h1 = h('h1', null, t.hero.title); h1.id = 'hero-title'; copy.appendChild(h1);
  copy.appendChild(h('p', 'lede', t.hero.lede));
  const ctas = h('div', 'ctas');
  const involve = h('a', 'btn primary', t.hero.ctaInvolve + ARROW); involve.href = '#journey'; involve.id = 'cta-involve';
  const learn = h('a', 'btn secondary', t.hero.ctaLearn); learn.href = t.links.learnMore; learn.rel = 'noopener'; learn.target = '_blank'; learn.id = 'cta-learn';
  ctas.appendChild(involve); ctas.appendChild(learn);
  copy.appendChild(ctas);
  hero.appendChild(copy);
  hero.appendChild(networkArt(t.hero.networkLabel));
  const stats = h('dl', 'stats');
  t.hero.stats.forEach(([n, label]) => { const d = h('div'); d.appendChild(h('dt', null, n)); d.appendChild(h('dd', null, label)); stats.appendChild(d); });
  hero.appendChild(stats);
  if (config.draftLanguages.includes(lang) && t.draftNote) hero.appendChild(h('p', 'draft', t.draftNote));
  main.appendChild(hero);

  // who we are
  const about = section('about', t.about.eyebrow, t.about.title);
  const grid = h('div', 'about-grid');
  grid.appendChild(h('p', 'about-body', t.about.body));
  const vals = h('div', 'values');
  vals.appendChild(h('h3', null, t.about.valuesTitle));
  const ul = h('ul');
  t.about.values.forEach((v) => ul.appendChild(h('li', null, v)));
  vals.appendChild(ul);
  grid.appendChild(vals);
  about.appendChild(grid);
  const phil = h('figure', 'philosophy');
  phil.appendChild(h('figcaption', null, t.about.philosophyTitle));
  phil.appendChild(h('blockquote', null, t.about.philosophy));
  about.appendChild(phil);
  main.appendChild(about);

  // path to impact
  const path = section('path', t.path.eyebrow, t.path.title);
  path.appendChild(h('p', 'section-lede', t.path.lede));
  const ol = h('ol', 'path-list');
  t.path.items.forEach(([title, body], i) => {
    const li = h('li');
    li.appendChild(h('span', 'num', String(i + 1).padStart(2, '0')));
    li.appendChild(h('h3', null, title));
    li.appendChild(h('p', null, body));
    ol.appendChild(li);
  });
  path.appendChild(ol);
  main.appendChild(path);

  // the three support streams
  const st = section('streams', t.streams.eyebrow, t.streams.title);
  const sg = h('div', 'stream-grid');
  config.streams.forEach((k) => {
    const s = t.streams[k], c = h('article', 'stream s-' + k);
    c.appendChild(h('h3', null, s.name)); c.appendChild(h('p', null, s.line)); c.appendChild(h('p', 'time', s.time));
    sg.appendChild(c);
  });
  st.appendChild(sg);
  st.appendChild(h('p', 'section-note', t.streams.note));
  main.appendChild(st);

  // your journey starts here: one card per form, each opens its own page
  const jo = section('journey', t.journey.eyebrow, t.journey.title);
  const jl = h('ol', 'journey-list');
  forms.forms.forEach((f, i) => {
    const li = h('li'), a = h('a', 'journey-card'); a.href = href('form.html', lang, { f: f.id }); a.id = 'go-' + f.id;
    a.innerHTML = '<span class="num">' + (i + 1) + '</span><b>' + t.forms[f.id].title + '</b><span class="line">' + t.forms[f.id].line + '</span><span class="go">' + t.journey.start + ARROW + '</span>';
    li.appendChild(a); jl.appendChild(li);
  });
  jo.appendChild(jl);
  main.appendChild(jo);

  // take the next step: the test
  const nx = h('section', 'next'); nx.id = 'next'; nx.setAttribute('aria-labelledby', 'next-title');
  const nh = h('h2', null, t.next.title); nh.id = 'next-title'; nx.appendChild(nh);
  nx.appendChild(h('p', null, t.next.lede));
  const test = h('a', 'btn test', t.next.test + ARROW); test.href = href('test.html', lang, { site: 1 }); test.id = 'take-test';
  nx.appendChild(test);
  main.appendChild(nx);

  main.appendChild(h('p', 'closing', t.closing));
  page.appendChild(main);
  page.appendChild(footer(t));
}

function section(id, eyebrow, title) {
  const s = h('section', id); s.id = id; s.setAttribute('aria-labelledby', id + '-title');
  s.appendChild(h('p', 'eyebrow', eyebrow));
  const t = h('h2', null, title); t.id = id + '-title'; s.appendChild(t);
  return s;
}

/* The moving network next to the headline: hubs joined by lines, with signals travelling between them.
   Drawn once in SVG; it stands still for visitors who ask their device for less motion. */
const NODES = [[160, 160, 14, 'core'], [70, 92, 8], [252, 82, 9], [282, 196, 7], [214, 270, 9], [96, 256, 7], [36, 180, 6], [168, 40, 7], [128, 212, 5], [214, 140, 5], [112, 132, 5], [300, 128, 4], [40, 40, 3], [290, 290, 3]];
const EDGES = [[0, 1], [0, 2], [0, 4], [0, 5], [0, 9], [0, 10], [0, 8], [1, 6], [1, 7], [1, 10], [2, 7], [2, 3], [2, 9], [2, 11], [3, 4], [3, 9], [3, 11], [4, 8], [4, 13], [5, 6], [5, 8], [6, 10], [7, 10], [1, 12]];
const SIGNALS = [[0, 2, 3.2], [1, 0, 4.1], [4, 0, 3.6], [0, 5, 4.6], [2, 3, 2.8], [6, 1, 3.4], [7, 2, 3.9], [3, 4, 3.1]];
function networkArt(label) {
  const wrap = h('div', 'network');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 320 320'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label);
  const el = (tag, attrs, parent = svg) => { const n = document.createElementNS(ns, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; };
  el('circle', { cx: 160, cy: 160, r: 150, class: 'orbit' });
  el('circle', { cx: 160, cy: 160, r: 96, class: 'orbit inner' });
  const lines = el('g', { class: 'edges' });
  EDGES.forEach(([a, b], i) => el('line', { x1: NODES[a][0], y1: NODES[a][1], x2: NODES[b][0], y2: NODES[b][1], style: '--d:' + (i % 6) * 0.5 + 's' }, lines));
  const sig = el('g', { class: 'signals' });
  SIGNALS.forEach(([a, b, dur], i) => {
    const dot = el('circle', { r: 3.2 }, sig);
    el('animateMotion', { dur: dur + 's', repeatCount: 'indefinite', begin: (i * 0.45) + 's', path: `M${NODES[a][0]},${NODES[a][1]} L${NODES[b][0]},${NODES[b][1]}` }, dot);
  });
  const nodes = el('g', { class: 'nodes' });
  NODES.forEach(([x, y, r, kind], i) => {
    const g = el('g', { class: 'node' + (kind ? ' ' + kind : ''), style: `--d:${(i % 5) * 0.7}s;transform-origin:${x}px ${y}px` }, nodes);
    if (r >= 7) el('circle', { cx: x, cy: y, r: r + 7, class: 'halo' }, g);
    el('circle', { cx: x, cy: y, r }, g);
  });
  wrap.appendChild(svg);
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => { if (still.matches) svg.pauseAnimations?.(); else svg.unpauseAnimations?.(); };
  requestAnimationFrame(apply);
  still.addEventListener?.('change', apply);
  return wrap;
}

loadSite().then((s) => {
  site = s; lang = s.lang;
  render();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}).catch((e) => {
  page.innerHTML = '<p class="loading">Could not load the page. Please reload.</p>';
  console.error(e);
});
registerWorker();
