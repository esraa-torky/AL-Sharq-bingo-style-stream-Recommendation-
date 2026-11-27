// Landing page (index.html), top to bottom: the hero over the living web (web.js), who we are with the six values,
// the philosophy band, the path to impact, the three support streams, "Your journey starts here" (each card opens
// its form on form.html), the Program Finder test, and the closing statement with the footer.
// All text comes from content/landing.<lang>.json.
import { h, ARROW, LANG_NAMES, loadSite, applyLang, href, topbar, registerWorker } from './site.js';
import { createWeb } from './web.js';

const page = document.getElementById('page');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const icon = (paths, cls = 'icon') => '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
const OUT = icon('<path d="M7 17 17 7M9 7h8v8"/>', 'arrow out');
const CLOCK = icon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>');
const INFO = icon('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.2"/>');
// One drawing per value, in the order of about.values: community around a centre, a rising line, a target,
// a sunrise, an open book, joined points.
const VALUE_ICONS = [
  '<circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="3.8" r="1.3"/><circle cx="19.1" cy="7.9" r="1.3"/><circle cx="19.1" cy="16.1" r="1.3"/><circle cx="12" cy="20.2" r="1.3"/><circle cx="4.9" cy="16.1" r="1.3"/><circle cx="4.9" cy="7.9" r="1.3"/>',
  '<path d="M3.5 17.5 9.5 11l4 4 7-8.5"/><path d="M15 6.5h5.5V12"/>',
  '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r=".9"/>',
  '<path d="M2.5 18.5h19M6.5 18.5a5.5 5.5 0 0 1 11 0M12 6.5V9M4.9 10.6l1.8 1.8M19.1 10.6l-1.8 1.8"/>',
  '<path d="M12 6.8C10 5.4 7.4 5 4 5.3v12.4c3.4-.3 6 .1 8 1.5 2-1.4 4.6-1.8 8-1.5V5.3c-3.4-.3-6 .1-8 1.5zM12 6.8v12.4"/>',
  '<circle cx="5.5" cy="6.5" r="2.2"/><circle cx="18.5" cy="8.5" r="2.2"/><circle cx="11" cy="18" r="2.2"/><path d="M7.6 7 16.4 8.2M6.4 8.5l3.7 7.6M17.2 10.3l-4.8 6.2"/>',
];
// A compass for Fellowship, a spark for Impact, a place for Hubs; and the form each stream's card opens.
const STREAM_ICONS = {
  F: '<circle cx="12" cy="12" r="8.5"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
  I: '<path d="M13 3 5 13.5h6L10 21l9-11.5h-6z"/>',
  H: '<path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.3"/>',
};
const STREAM_FORM = { F: 'join-program', I: 'join-program', H: 'join-hub' };

let site, lang, bar, heroEl, first = true, appear, spy;
const webs = {}; // the canvases live on through language changes, so the web never restarts

function render() {
  const { config, forms, texts } = site, t = texts[lang];
  applyLang(config, t, lang);
  document.title = t.meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', t.meta.description);
  page.innerHTML = '';
  // sections rise into view as they are reached, on the first visit only; after a language change everything is simply there
  page.classList.toggle('static', !first || calm.matches || !('IntersectionObserver' in window));
  const skip = h('a', 'skip', t.nav.skip); skip.href = '#main';
  page.appendChild(skip);
  page.appendChild(topBar(config, t));
  const main = h('main'); main.id = 'main'; main.tabIndex = -1;
  [hero, about, philosophy, path, streams, journey, next].forEach((part) => main.appendChild(part(t, config, forms)));
  page.appendChild(main);
  page.appendChild(foot(t, config, forms));
  watch();
  first = false;
  onScroll();
}

/* ---------- top bar ---------- */

// Stays at the top of the screen: clear over the hero, solid once the hero has scrolled away.
// On narrow screens the section links fold into a menu that opens under the bar.
function topBar(config, t) {
  bar = topbar(config, t, lang, (l) => { lang = l; render(); });
  bar.classList.add('sticky', 'over-hero');
  const nav = h('nav', 'site-nav'); nav.id = 'site-nav'; nav.setAttribute('aria-label', t.nav.menu);
  sectionLinks(t).forEach((a) => nav.appendChild(a));
  const joinInMenu = h('a', 'btn primary nav-join', t.hero.ctaInvolve + ARROW); joinInMenu.href = '#journey';
  nav.appendChild(joinInMenu);
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  bar.insertBefore(nav, bar.lastChild);
  const join = h('a', 'btn nav-cta', t.hero.ctaInvolve); join.href = '#journey';
  bar.lastChild.appendChild(join);
  const menu = h('button', 'menu-btn', '<span></span><span></span>'); menu.type = 'button'; menu.id = 'menu';
  menu.setAttribute('aria-label', t.nav.menu); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-controls', 'site-nav');
  menu.addEventListener('click', () => setMenu(!bar.classList.contains('open')));
  bar.lastChild.appendChild(menu);
  return bar;
}
const sectionLinks = (t) => [['about', t.about.eyebrow], ['path', t.path.eyebrow], ['streams', t.streams.eyebrow]].map(([id, text]) => { const a = h('a', null, text); a.href = '#' + id; return a; });
function setMenu(open) {
  if (!bar) return;
  bar.classList.toggle('open', open);
  bar.querySelector('.menu-btn').setAttribute('aria-expanded', String(open));
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bar && bar.classList.contains('open')) { setMenu(false); bar.querySelector('.menu-btn').focus(); } });
document.addEventListener('click', (e) => { if (bar && bar.classList.contains('open') && !bar.contains(e.target)) setMenu(false); });

// The bar is clear at the very top, dark glass while the hero scrolls under it, and solid after the hero.
function onScroll() {
  if (!bar || !heroEl) return;
  bar.classList.toggle('over-hero', window.scrollY < heroEl.offsetHeight - bar.offsetHeight);
  bar.classList.toggle('stuck', window.scrollY > 8);
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });

/* ---------- sections ---------- */

// hero: the web fills the whole background; headline, actions and numbers sit on top
function hero(t, config) {
  const s = h('section', 'hero' + (first ? ' intro' : '')); s.setAttribute('aria-labelledby', 'hero-title');
  heroEl = s;
  webs.hero = webs.hero || createWeb();
  webs.hero.label(t.hero.networkLabel);
  s.appendChild(webs.hero.el);
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
  s.appendChild(copy);
  const stats = h('dl', 'stats');
  t.hero.stats.forEach(([n, label]) => { const d = h('div'); d.appendChild(figure(n)); d.appendChild(h('dd', null, label)); stats.appendChild(d); });
  s.appendChild(stats);
  return s;
}

// who we are: the three-word statement beside the introduction, then the six values on a ruled strip
function about(t) {
  const s = section('about');
  const head = h('div', 'about-head');
  const lead = reveal(h('div'));
  lead.appendChild(h('p', 'eyebrow', t.about.eyebrow));
  const title = h('h2', 'statement', sentences(t.about.title)); title.id = 'about-title'; lead.appendChild(title);
  head.appendChild(lead);
  head.appendChild(reveal(h('p', 'about-body', t.about.body), 1));
  s.appendChild(head);
  const vals = h('div', 'values');
  vals.appendChild(h('h3', null, t.about.valuesTitle));
  const ul = h('ul');
  t.about.values.forEach((v, i) => ul.appendChild(reveal(h('li', null, icon(VALUE_ICONS[i % VALUE_ICONS.length]) + '<span>' + v + '</span>'), i)));
  vals.appendChild(ul);
  s.appendChild(vals);
  return s;
}

// philosophy of change: a dark band with a quiet echo of the web
function philosophy(t) {
  const s = h('section', 'quote band'); s.setAttribute('aria-labelledby', 'quote-title');
  s.appendChild(echo('quote'));
  const fig = reveal(h('figure'));
  const cap = h('figcaption', 'eyebrow', t.about.philosophyTitle); cap.id = 'quote-title';
  fig.appendChild(cap);
  fig.appendChild(h('blockquote', null, t.about.philosophy));
  s.appendChild(fig);
  return s;
}

// path to impact: four steps on a line that draws itself when the section comes into view
function path(t) {
  const s = section('path');
  s.appendChild(reveal(header('path', t.path.eyebrow, t.path.title, t.path.lede)));
  const ol = reveal(h('ol', 'path-list'));
  t.path.items.forEach(([title, body], i) => {
    const li = h('li'); li.style.setProperty('--i', i);
    li.appendChild(h('span', 'num', String(i + 1).padStart(2, '0')));
    li.appendChild(h('h3', null, title));
    li.appendChild(h('p', null, body));
    ol.appendChild(li);
  });
  s.appendChild(ol);
  return s;
}

// the three support streams: each card carries its colour, drawing, weekly time and a link to its form
function streams(t, config) {
  const s = section('streams');
  s.appendChild(reveal(header('streams', t.streams.eyebrow, t.streams.title)));
  const grid = h('div', 'stream-grid');
  config.streams.forEach((k, i) => {
    const d = t.streams[k], form = STREAM_FORM[k] || 'join-program', c = reveal(h('article', 'stream s-' + k), i);
    c.appendChild(h('div', 'stream-top', icon(STREAM_ICONS[k] || STREAM_ICONS.F, 'icon mark') + '<span class="time">' + CLOCK + d.time + '</span>'));
    c.appendChild(h('h3', null, d.name));
    c.appendChild(h('p', null, d.line));
    const go = h('a', 'stream-go', '<span>' + t.forms[form].title + '</span>' + ARROW); go.href = href('form.html', lang, { f: form }); go.id = 'stream-' + k;
    c.appendChild(go);
    grid.appendChild(c);
  });
  s.appendChild(grid);
  s.appendChild(reveal(h('p', 'notice', INFO + '<span>' + t.streams.note + '</span>')));
  return s;
}

// your journey starts here: one card per form, each opens its own page
function journey(t, config, forms) {
  const s = section('journey', 'journey band');
  s.appendChild(echo('journey'));
  s.appendChild(reveal(header('journey', t.journey.eyebrow, t.journey.title)));
  const list = h('ol', 'journey-list');
  forms.forms.forEach((f, i) => {
    const li = reveal(h('li'), i), a = h('a', 'journey-card'); a.href = href('form.html', lang, { f: f.id }); a.id = 'go-' + f.id;
    a.innerHTML = '<span class="num">' + (i + 1) + '</span><b>' + t.forms[f.id].title + '</b><span class="line">' + t.forms[f.id].line + '</span><span class="go">' + t.journey.start + ARROW + '</span>';
    li.appendChild(a); list.appendChild(li);
  });
  s.appendChild(list);
  return s;
}

// take the next step: the Program Finder test, with a small bingo card that stamps itself
function next(t) {
  const s = section('next');
  const card = h('div', 'next-card');
  const copy = reveal(h('div', 'next-copy'));
  const title = h('h2', null, t.next.title); title.id = 'next-title'; copy.appendChild(title);
  copy.appendChild(h('p', 'section-lede', t.next.lede));
  const facts = h('ul', 'facts');
  t.next.facts.forEach((f) => facts.appendChild(h('li', null, f)));
  copy.appendChild(facts);
  const test = h('a', 'btn test', '<span>' + t.next.test + '</span>' + ARROW); test.href = href('test.html', lang, { site: 1 }); test.id = 'take-test';
  copy.appendChild(test);
  card.appendChild(copy);
  card.appendChild(bingo());
  s.appendChild(card);
  return s;
}

// closing statement, then the footer: logo, section links, the three ways in, languages and the Al Sharq Forum link
function foot(t, config, forms) {
  const f = h('footer', 'site-foot');
  f.appendChild(reveal(h('p', 'closing', sentences(t.closing))));
  const grid = h('div', 'foot-grid');
  const brand = h('div', 'foot-brand', '<img class="logo" alt="' + t.nav.home + '" src="assets/logo-dark.png" width="472" height="189" loading="lazy">');
  brand.appendChild(h('p', null, t.footer.line));
  grid.appendChild(brand);
  const column = (title, links) => {
    const nav = h('nav'); nav.setAttribute('aria-label', title);
    nav.appendChild(h('p', 'foot-title', title));
    const ul = h('ul'); links.forEach((a) => { const li = h('li'); li.appendChild(a); ul.appendChild(li); });
    nav.appendChild(ul);
    return nav;
  };
  grid.appendChild(column(t.nav.home, sectionLinks(t)));
  grid.appendChild(column(t.journey.eyebrow, forms.forms.map((x) => { const a = h('a', null, t.forms[x.id].title); a.href = href('form.html', lang, { f: x.id }); return a; })));
  f.appendChild(grid);
  const base = h('div', 'foot-base');
  const langs = h('ul', 'foot-langs');
  config.languages.forEach((l) => {
    const li = h('li'), a = h('a', null, (LANG_NAMES[l] || [l, l])[1]); a.href = href('index.html', l); a.lang = l;
    if (l === lang) a.setAttribute('aria-current', 'true');
    li.appendChild(a); langs.appendChild(li);
  });
  base.appendChild(langs);
  const out = h('a', 'foot-out', '<span>' + t.footer.site + '</span>' + OUT); out.href = 'https://youth.sharqforum.org/'; out.rel = 'noopener';
  base.appendChild(out);
  f.appendChild(base);
  return f;
}

/* ---------- building blocks ---------- */

function section(id, cls) {
  const s = h('section', cls || id); s.id = id; s.setAttribute('aria-labelledby', id + '-title');
  return s;
}
function header(id, eyebrow, title, lede) {
  const d = h('div', 'section-head');
  d.appendChild(h('p', 'eyebrow', eyebrow));
  const t = h('h2', null, title); t.id = id + '-title'; d.appendChild(t);
  if (lede) d.appendChild(h('p', 'section-lede', lede));
  return d;
}

// Marks an element to rise into view when it is reached; `order` staggers neighbours.
function reveal(el, order = 0) { el.classList.add('reveal'); el.style.setProperty('--i', order); return el; }

// "Inspire. Empower. Connect." becomes one piece per sentence, each with its full stop in gold.
function sentences(text) {
  return (text.match(/[^.!?؟]+[.!?؟]*/g) || [text]).map((part) => {
    const m = /^(.*?)([.!?؟]*)$/.exec(part.trim());
    return '<span class="s">' + m[1] + '<span class="dot">' + m[2] + '</span></span>';
  }).join(' ');
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

// The quiet web behind a dark band: fainter than the hero's (see .band-web), and it does not follow the pointer.
function echo(name) {
  webs[name] = webs[name] || createWeb({ density: 0.9, interactive: false, className: 'band-web' });
  return webs[name].el;
}

// A small bingo card for the test block. Decoration only: the stamps land one by one and the middle row wins.
const STAMPED = [1, 7, 18, 5, 22, 10, 11, 13, 14];
function bingo() {
  const b = reveal(h('div', 'bingo')); b.setAttribute('aria-hidden', 'true');
  const head = h('div', 'bingo-head'); [...'BINGO'].forEach((c) => head.appendChild(h('span', null, c)));
  b.appendChild(head);
  const grid = h('div', 'bingo-grid');
  for (let i = 0; i < 25; i++) {
    const row = Math.floor(i / 5), at = STAMPED.indexOf(i);
    const cell = h('span', 'cell' + (row === 2 ? ' win' : '') + (i === 12 ? ' star' : at >= 0 ? ' on' : ''), i === 12 ? '★' : '');
    if (at >= 0) cell.style.setProperty('--k', at);
    grid.appendChild(cell);
  }
  b.appendChild(grid);
  return b;
}

// Reveals each marked element when it scrolls into view, and marks the section being read in the top bar.
function watch() {
  if (appear) appear.disconnect();
  if (spy) spy.disconnect();
  // .in stays on for good; .reveal is dropped once the rise has finished, so the stagger delay never slows a card's hover effect
  const marked = page.querySelectorAll('.reveal');
  if (page.classList.contains('static')) marked.forEach((el) => { el.classList.add('in'); el.classList.remove('reveal'); });
  else {
    appear = new IntersectionObserver((seen) => seen.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target; appear.unobserve(el);
      el.classList.add('in');
      setTimeout(() => el.classList.remove('reveal'), 1700);
    }), { rootMargin: '0px 0px -10% 0px' });
    marked.forEach((el) => appear.observe(el));
  }
  if (!('IntersectionObserver' in window)) return;
  spy = new IntersectionObserver((seen) => seen.forEach((e) => {
    bar.querySelectorAll('.site-nav a[href="#' + e.target.id + '"]').forEach((a) => { if (e.isIntersecting) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['about', 'path', 'streams'].forEach((id) => spy.observe(document.getElementById(id)));
}

// printing shows the whole page, including parts that have not been scrolled to yet
window.addEventListener('beforeprint', () => page.querySelectorAll('.reveal').forEach((el) => { el.classList.add('in'); el.classList.remove('reveal'); }));
window.__landing = { get web() { return webs.hero; } }; // lets the smoke test see that the web is drawing

loadSite().then((s) => {
  site = s; lang = s.lang;
  render();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}).catch((e) => {
  page.innerHTML = '<p class="loading">Could not load the page. Please reload.</p>';
  console.error(e);
});
registerWorker();
