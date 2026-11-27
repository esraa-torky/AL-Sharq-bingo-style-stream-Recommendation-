// Landing page (index.html): Al Sharq Youth hero over the living web (web.js), who we are, the path to impact,
// the three support streams, "Your journey starts here" (each card opens its form on form.html),
// and "Take the next step" with the Program Finder test. All text comes from content/landing.<lang>.json.
import { h, ARROW, loadSite, applyLang, href, topbar, footer, registerWorker } from './site.js';
import { createWeb } from './web.js';

const page = document.getElementById('page');
const OUT = '<svg class="arrow out" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let site, lang, web, bar, heroEl, first = true;

function render() {
  const { config, forms, texts } = site, t = texts[lang];
  applyLang(config, t, lang);
  document.title = t.meta.title;
  page.innerHTML = '';
  // top bar: stays at the top of the screen; clear over the hero, solid once the hero has scrolled away
  bar = topbar(config, t, lang, (l) => { lang = l; render(); });
  bar.classList.add('sticky', 'over-hero');
  const nav = h('nav', 'site-nav'); nav.setAttribute('aria-label', t.nav.home);
  [['about', t.about.eyebrow], ['path', t.path.eyebrow], ['streams', t.streams.eyebrow]].forEach(([id, text]) => { const a = h('a', null, text); a.href = '#' + id; nav.appendChild(a); });
  bar.insertBefore(nav, bar.lastChild);
  const join = h('a', 'btn nav-cta', t.hero.ctaInvolve); join.href = '#journey';
  bar.lastChild.appendChild(join);
  page.appendChild(bar);
  const main = h('main'); main.id = 'main';

  // hero: the web fills the whole background; headline, actions and numbers sit on top
  const hero = h('section', 'hero' + (first ? ' intro' : '')); hero.setAttribute('aria-labelledby', 'hero-title');
  heroEl = hero;
  web = web || createWeb();
  web.label(t.hero.networkLabel);
  hero.appendChild(web.el);
  const copy = h('div', 'hero-copy');
  copy.appendChild(h('p', 'eyebrow', t.hero.eyebrow));
  const h1 = h('h1', null, t.hero.title); h1.id = 'hero-title'; words(h1); copy.appendChild(h1);
  copy.appendChild(h('p', 'lede', t.hero.lede));
  const ctas = h('div', 'ctas');
  const involve = h('a', 'btn primary', t.hero.ctaInvolve + ARROW); involve.href = '#journey'; involve.id = 'cta-involve';
  const learn = h('a', 'btn secondary', t.hero.ctaLearn + OUT); learn.href = t.links.learnMore; learn.rel = 'noopener'; learn.target = '_blank'; learn.id = 'cta-learn';
  ctas.appendChild(involve); ctas.appendChild(learn);
  if (config.draftLanguages.includes(lang) && t.draftNote) ctas.appendChild(h('p', 'draft', t.draftNote));
  copy.appendChild(ctas);
  hero.appendChild(copy);
  const stats = h('dl', 'stats');
  t.hero.stats.forEach(([n, label]) => { const d = h('div'); d.appendChild(figure(n)); d.appendChild(h('dd', null, label)); stats.appendChild(d); });
  hero.appendChild(stats);
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
  first = false;
  onScroll();
}

// Wraps each word of the headline so the words can rise in one after another. <em> in the text marks the highlighted words.
function words(el) {
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((c) => {
      if (c.nodeType !== 3) { walk(c); return; }
      const frag = document.createDocumentFragment();
      c.textContent.split(/(\s+)/).forEach((part) => {
        if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
        const w = h('span', 'w'); w.textContent = part; w.style.setProperty('--i', i++); frag.appendChild(w);
      });
      node.replaceChild(frag, c);
    });
  };
  walk(el);
}

// A number in the hero ("800+", "+40"): the digits count up once when the page opens, the plus sign stays gold.
function figure(text) {
  const dt = h('dt'), m = /^(\D*)(\d+)(\D*)$/.exec(text);
  if (!m) { dt.textContent = text; return dt; }
  const [, pre, digits, post] = m, to = Number(digits);
  if (pre) { const s = h('span', 'sign'); s.textContent = pre; dt.appendChild(s); }
  const num = h('span', 'n'); num.textContent = digits; dt.appendChild(num);
  if (post) { const s = h('span', 'sign'); s.textContent = post; dt.appendChild(s); }
  if (!first || calm.matches) return dt;
  num.textContent = '0';
  const t0 = performance.now() + 700, dur = 1500;
  const tick = (now) => {
    const k = Math.min(1, Math.max(0, (now - t0) / dur));
    num.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 4))));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return dt;
}

// The top bar is clear at the very top, dark glass while the hero scrolls under it, and solid after the hero.
function onScroll() {
  if (!bar || !heroEl) return;
  const over = window.scrollY < heroEl.offsetHeight - bar.offsetHeight;
  bar.classList.toggle('over-hero', over);
  bar.classList.toggle('stuck', window.scrollY > 8);
}
window.__landing = { get web() { return web; } }; // lets the smoke test see that the web is drawing
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });

function section(id, eyebrow, title) {
  const s = h('section', id); s.id = id; s.setAttribute('aria-labelledby', id + '-title');
  s.appendChild(h('p', 'eyebrow', eyebrow));
  const t = h('h2', null, title); t.id = id + '-title'; s.appendChild(t);
  return s;
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
