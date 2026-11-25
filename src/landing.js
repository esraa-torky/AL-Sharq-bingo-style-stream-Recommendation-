// Landing page: Al Sharq Youth header, the Program Finder test, the three support streams and three forms
// (join a hub, open a hub, join a program). All text comes from content/landing.<lang>.json, the fields from
// content/forms.json. Submissions go to the same Google Apps Script as the test, one sheet tab per form.
import { h, deckle, addRims, labelBtn, logos } from './paper.js';
import { saveResult, flushQueue } from './save.js';
import { fill } from './scoring.js';

const page = document.getElementById('page');
let config, forms, texts = {}, lang;
let active = null;        // id of the form on screen
let fromTest = null;      // { stream, personality } when the visitor came from the test
let sent = null;          // { form, name } after a successful send
const lastSubmissions = []; // for the automated tests

const T = () => texts[lang];
const EN = () => texts.en;

async function loadJSON(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

async function start() {
  [config, forms] = await Promise.all([loadJSON('content/config.json'), loadJSON('content/forms.json')]);
  const loaded = await Promise.all(config.languages.map((l) => loadJSON('content/landing.' + l + '.json')));
  config.languages.forEach((l, i) => { texts[l] = loaded[i]; });
  const q = new URLSearchParams(location.search);
  const fromHash = location.hash.slice(1);
  if (forms.forms.some((f) => f.id === fromHash)) active = fromHash;
  setLang(config.languages.includes(q.get('lang')) ? q.get('lang') : config.defaultLanguage, false);
  flushQueue(config.resultsUrl);
  window.addEventListener('online', () => flushQueue(config.resultsUrl));
  window.addEventListener('message', onTestMessage);
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (forms.forms.some((f) => f.id === id) && id !== active) { active = id; sent = null; render(); scrollToForms(); }
  });
}

function setLang(l, keepValues = true) {
  const values = keepValues ? readValues() : null;
  lang = l;
  document.documentElement.lang = lang;
  document.documentElement.dir = config.rightToLeft.includes(lang) ? 'rtl' : 'ltr';
  document.title = T().meta.title;
  render();
  if (values) writeValues(values);
}

/* ---------- page ---------- */
function render() {
  const t = T();
  page.innerHTML = '';

  // top bar
  const bar = h('header', 'topbar');
  const brand = h('a', 'brand'); brand.href = 'https://youth.sharqforum.org/'; brand.innerHTML = logos(); brand.setAttribute('aria-label', 'Al Sharq Youth');
  bar.appendChild(brand);
  const langs = h('div', 'lang-chips'); langs.setAttribute('role', 'group'); langs.setAttribute('aria-label', 'Language');
  const names = { en: ['EN', 'English'], tr: ['TR', 'Türkçe'], ar: ['ع', 'العربية'] };
  config.languages.forEach((l) => {
    const b = h('button', null, (names[l] || [l])[0]); b.type = 'button'; b.id = 'lang-' + l;
    b.setAttribute('aria-label', (names[l] || [l, l])[1]); b.setAttribute('aria-pressed', String(l === lang));
    b.addEventListener('click', () => setLang(l)); langs.appendChild(b);
  });
  bar.appendChild(langs);
  page.appendChild(bar);

  // hero
  const hero = h('section', 'hero'); hero.setAttribute('aria-labelledby', 'hero-title');
  const sheet = h('div', 'hero-sheet');
  sheet.appendChild(h('p', 'eyebrow', t.hero.eyebrow));
  const h1 = h('h1', null, t.hero.title); h1.id = 'hero-title'; sheet.appendChild(h1);
  sheet.appendChild(h('p', 'lede', t.hero.lede));
  const stats = h('dl', 'stats');
  t.hero.stats.forEach((s) => { const d = h('div'); d.appendChild(h('dt', null, s[0])); d.appendChild(h('dd', null, s[1])); stats.appendChild(d); });
  sheet.appendChild(stats);
  const ctas = h('div', 'ctas');
  const goTest = labelBtn(t.hero.ctaTest); goTest.id = 'cta-test';
  goTest.querySelector('button').addEventListener('click', openTest);
  const goForms = h('a', 'ghost', t.hero.ctaForms); goForms.href = '#involve';
  ctas.appendChild(goTest); ctas.appendChild(goForms);
  sheet.appendChild(ctas);
  deckle(sheet, 2.2, 'b');
  hero.appendChild(sheet);
  if (config.draftLanguages.includes(lang) && t.draftNote) hero.appendChild(h('p', 'draft', t.draftNote));
  page.appendChild(hero);

  // the test
  const test = h('section', 'test'); test.id = 'test'; test.setAttribute('aria-labelledby', 'test-title');
  const card = h('div', 'test-card');
  const bw = h('div', 'bingo-word'); bw.setAttribute('aria-hidden', 'true');
  ['B', 'I', 'N', 'G', 'O'].forEach((L, i) => { const sq = h('span', 'bl' + (i === 3 ? ' stamped' : ''), L); bw.appendChild(sq); });
  card.appendChild(bw);
  const tx = h('div', 'test-text');
  tx.appendChild(h('p', 'eyebrow', t.test.eyebrow));
  const th = h('h2', null, t.test.title); th.id = 'test-title'; tx.appendChild(th);
  tx.appendChild(h('p', null, t.test.lede));
  const startBtn = labelBtn(t.test.button); startBtn.id = 'start-test';
  startBtn.querySelector('button').addEventListener('click', openTest);
  tx.appendChild(startBtn);
  tx.appendChild(h('p', 'fine', t.test.languages));
  card.appendChild(tx);
  test.appendChild(card);
  page.appendChild(test);

  // streams
  const st = h('section', 'streams'); st.setAttribute('aria-labelledby', 'streams-title');
  st.appendChild(h('p', 'eyebrow', t.streams.eyebrow));
  const sh = h('h2', null, t.streams.title); sh.id = 'streams-title'; st.appendChild(sh);
  const grid = h('div', 'stream-grid');
  ['F', 'I', 'H'].forEach((k) => {
    const s = t.streams[k], c = h('article', 'stream');
    c.appendChild(h('h3', null, s.name)); c.appendChild(h('p', null, s.line)); c.appendChild(h('p', 'time', s.time));
    grid.appendChild(c);
  });
  st.appendChild(grid);
  st.appendChild(h('p', 'stream-note', t.streams.note));
  page.appendChild(st);

  // get involved
  const inv = h('section', 'involve'); inv.id = 'involve'; inv.setAttribute('aria-labelledby', 'involve-title');
  inv.appendChild(h('p', 'eyebrow', t.involve.eyebrow));
  const ih = h('h2', null, t.involve.title); ih.id = 'involve-title'; inv.appendChild(ih);
  inv.appendChild(h('p', 'muted', t.involve.lede));
  const choices = h('div', 'choices'); choices.setAttribute('role', 'tablist');
  forms.forms.forEach((f, i) => {
    const b = h('button', 'choice' + (active === f.id ? ' on' : ''));
    b.type = 'button'; b.id = 'choose-' + f.id; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(active === f.id));
    b.setAttribute('aria-controls', 'form-panel');
    b.innerHTML = '<span class="letter" aria-hidden="true">' + ['B', 'I', 'N'][i] + '</span><b>' + t.involve.cards[f.id].title + '</b><span>' + t.involve.cards[f.id].line + '</span>';
    b.addEventListener('click', () => choose(f.id));
    deckle(b, 1.1, 'rb');
    const w = h('div', 'choice-wrap'); w.appendChild(b); choices.appendChild(w);
  });
  inv.appendChild(choices);
  const panel = h('div', 'form-panel'); panel.id = 'form-panel'; panel.setAttribute('role', 'tabpanel');
  if (active) panel.appendChild(sent && sent.form === active ? successBox() : buildForm(forms.forms.find((f) => f.id === active)));
  else panel.hidden = true;
  inv.appendChild(panel);
  page.appendChild(inv);

  // footer
  const foot = h('footer', 'foot');
  foot.appendChild(h('p', null, t.footer.line));
  const site = h('a', null, t.footer.site); site.href = 'https://youth.sharqforum.org/'; foot.appendChild(site);
  page.appendChild(foot);

  addRims(page);
}

function choose(id, focus = true) {
  active = id; sent = null;
  history.replaceState(null, '', '#' + id);
  render();
  if (focus) {
    scrollToForms();
    const first = page.querySelector('#form-panel input, #form-panel select, #form-panel textarea');
    if (first) first.focus({ preventScroll: true });
  }
}
function scrollToForms() {
  const el = document.getElementById('involve');
  if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

/* ---------- forms ---------- */
function fieldsOf(form) { return forms.shared.concat(form.fields); }

function buildForm(form) {
  const t = T(), f = h('form', 'form'); f.id = 'form-' + form.id; f.noValidate = true;
  f.dataset.form = form.id;
  if (fromTest && form.id === 'join-program') {
    f.appendChild(h('p', 'from-test', fill(t.form.fromTest, { stream: t.options.program[fromTest.stream] })));
  }
  const grid = h('div', 'fields');
  fieldsOf(form).forEach((fd) => grid.appendChild(buildField(form, fd)));
  f.appendChild(grid);
  // spam trap: people never see or fill this
  const trap = h('div', 'trap'); trap.setAttribute('aria-hidden', 'true');
  trap.innerHTML = '<label>Website<input name="website" tabindex="-1" autocomplete="off"></label>';
  f.appendChild(trap);
  const consent = h('label', 'consent');
  consent.innerHTML = '<input type="checkbox" name="consent" id="f-consent" required> <span>' + t.form.consent + '</span>';
  f.appendChild(consent);
  const cerr = h('p', 'err'); cerr.id = 'err-consent'; cerr.hidden = true; f.appendChild(cerr);
  f.appendChild(h('p', 'privacy', t.form.privacy));
  const summary = h('p', 'summary'); summary.setAttribute('role', 'alert'); summary.hidden = true; f.appendChild(summary);
  const send = labelBtn(t.form.submit); send.classList.add('send');
  const sb = send.querySelector('button'); sb.type = 'submit'; sb.id = 'send';
  f.appendChild(send);
  f.addEventListener('submit', (e) => { e.preventDefault(); submit(form, f); });
  f.addEventListener('change', () => applyConditions(form, f));
  setTimeout(() => applyConditions(form, f));
  return f;
}

function buildField(form, fd) {
  const t = T(), label = t.fields[fd.id] || { label: fd.id }, id = 'f-' + fd.id;
  const wrap = h('div', 'field' + (fd.type === 'textarea' || fd.type === 'checkboxes' || fd.type === 'radios' ? ' wide' : ''));
  wrap.dataset.field = fd.id;
  const opt = fd.required ? '' : ' <span class="opt">(' + t.form.optional + ')</span>';
  const hint = label.hint ? '<span class="hint" id="hint-' + fd.id + '">' + label.hint + '</span>' : '';
  let control;
  if (fd.type === 'checkboxes' || fd.type === 'radios') {
    control = h('fieldset', 'set');
    control.innerHTML = '<legend>' + label.label + opt + '</legend>' + hint;
    const box = h('div', 'set-options');
    fd.options.forEach((o) => {
      const l = h('label', 'pick');
      const inp = document.createElement('input');
      inp.type = fd.type === 'radios' ? 'radio' : 'checkbox'; inp.name = fd.id; inp.value = o; inp.id = id + '-' + o;
      if (fd.id === 'program' && fromTest && fromTest.stream === o) inp.checked = true;
      l.appendChild(inp); l.appendChild(h('span', null, t.options[fd.id][o]));
      box.appendChild(l);
    });
    control.appendChild(box);
    wrap.appendChild(control);
  } else {
    wrap.appendChild(h('label', null, label.label + opt)).htmlFor = id;
    if (label.hint) wrap.insertAdjacentHTML('beforeend', hint);
    if (fd.type === 'textarea') { control = document.createElement('textarea'); control.rows = 4; }
    else if (fd.type === 'select' || fd.type === 'hub') {
      control = document.createElement('select');
      control.appendChild(new Option(fd.type === 'hub' ? t.hubs.choose : t.form.choose, ''));
      if (fd.type === 'hub') {
        forms.regions.forEach((r) => {
          const g = document.createElement('optgroup'); g.label = t.hubs.regions[r];
          forms.hubs.filter((x) => x.region === r).forEach((x) => g.appendChild(new Option(t.hubs.cities[x.id] + ' · ' + t.hubs.countries[x.country], x.id)));
          control.appendChild(g);
        });
        control.appendChild(new Option(t.hubs.notListed, 'not-listed'));
      } else {
        fd.options.forEach((o) => control.appendChild(new Option(t.options[fd.id][o], o)));
      }
    } else {
      control = document.createElement('input');
      control.type = fd.type;
      if (fd.type === 'email') control.inputMode = 'email';
      if (fd.type === 'tel') { control.inputMode = 'tel'; control.dir = 'ltr'; }
      if (fd.type === 'url') { control.inputMode = 'url'; control.dir = 'ltr'; control.placeholder = 'https://'; }
    }
    control.id = id; control.name = fd.id;
    if (fd.autocomplete) control.autocomplete = fd.autocomplete;
    if (fd.required) control.setAttribute('aria-required', 'true');
    if (label.hint) control.setAttribute('aria-describedby', 'hint-' + fd.id);
    wrap.appendChild(control);
  }
  const err = h('p', 'err'); err.id = 'err-' + fd.id; err.hidden = true;
  wrap.appendChild(err);
  if (fd.showWhen) wrap.dataset.showWhen = JSON.stringify(fd.showWhen);
  if (fd.type === 'hub') {
    // no hub in their city: offer the open-a-hub form
    const tip = h('button', 'switch', T().involve.cards['open-hub'].title + ' →'); tip.type = 'button'; tip.hidden = true; tip.id = 'to-open-hub';
    tip.addEventListener('click', () => choose('open-hub'));
    wrap.appendChild(tip);
  }
  return wrap;
}

function applyConditions(form, f) {
  const vals = new FormData(f);
  f.querySelectorAll('[data-show-when]').forEach((w) => {
    const cond = JSON.parse(w.dataset.showWhen);
    w.hidden = !Object.keys(cond).every((k) => vals.get(k) === cond[k]);
  });
  const tip = f.querySelector('#to-open-hub');
  if (tip) tip.hidden = vals.get('hub') !== 'not-listed';
}

function valueOf(f, fd) {
  if (fd.type === 'checkboxes') return [...f.querySelectorAll('input[name="' + fd.id + '"]:checked')].map((x) => x.value);
  const el = f.elements[fd.id];
  if (!el) return '';
  if (el instanceof RadioNodeList) return el.value || '';
  return (el.value || '').trim();
}

function validate(form, f) {
  const t = T(), bad = [];
  const set = (id, msg) => {
    const e = f.querySelector('#err-' + id); if (!e) return;
    e.textContent = msg || ''; e.hidden = !msg;
    const wrap = f.querySelector('[data-field="' + id + '"]');
    if (wrap) wrap.classList.toggle('invalid', !!msg);
    const ctl = f.elements[id];
    if (ctl && ctl.setAttribute) { ctl.setAttribute('aria-invalid', String(!!msg)); if (msg) ctl.setAttribute('aria-errormessage', 'err-' + id); }
    if (msg) bad.push(id);
  };
  fieldsOf(form).forEach((fd) => {
    const wrap = f.querySelector('[data-field="' + fd.id + '"]');
    if (wrap && wrap.hidden) { set(fd.id, ''); return; }
    const v = valueOf(f, fd), empty = Array.isArray(v) ? v.length === 0 : v === '';
    if (fd.required && empty) return set(fd.id, t.form.missing);
    if (!empty && fd.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return set(fd.id, t.form.badEmail);
    if (!empty && fd.type === 'url' && !/^https?:\/\/\S+\.\S+/.test(v)) return set(fd.id, t.form.badUrl);
    set(fd.id, '');
  });
  const consent = f.querySelector('#f-consent'), cerr = f.querySelector('#err-consent');
  cerr.textContent = consent.checked ? '' : t.form.missing; cerr.hidden = consent.checked;
  consent.setAttribute('aria-invalid', String(!consent.checked));
  if (!consent.checked) bad.push('consent');
  return bad;
}

// What the sheet receives: readable English labels, whatever language the visitor used
function readable(fd, v) {
  const en = EN();
  const one = (o) => {
    if (fd.type === 'hub') {
      if (o === 'not-listed') return en.hubs.notListed;
      const hub = forms.hubs.find((x) => x.id === o);
      return hub ? en.hubs.cities[hub.id] + ', ' + en.hubs.countries[hub.country] : o;
    }
    return fd.options && en.options[fd.id] ? (en.options[fd.id][o] || o) : o;
  };
  return Array.isArray(v) ? v.map(one).join(', ') : (fd.options || fd.type === 'hub') && v ? one(v) : v;
}

function submit(form, f) {
  const t = T();
  const bad = validate(form, f), summary = f.querySelector('.summary');
  if (bad.length) {
    summary.textContent = t.form.fixErrors; summary.hidden = false;
    const first = bad[0] === 'consent' ? f.querySelector('#f-consent') : f.querySelector('[name="' + bad[0] + '"]');
    if (first && first.focus) first.focus();
    return;
  }
  summary.hidden = true;
  const btn = f.querySelector('#send'); btn.disabled = true; btn.querySelector('span').textContent = t.form.sending;
  const row = { form: form.id, sheet: form.sheet, time: new Date().toISOString(), lang };
  fieldsOf(form).forEach((fd) => {
    const wrap = f.querySelector('[data-field="' + fd.id + '"]');
    row[fd.id] = wrap && wrap.hidden ? '' : readable(fd, valueOf(f, fd));
  });
  row.testMatch = fromTest ? EN().options.program[fromTest.stream] : '';
  row.testPersonality = fromTest ? fromTest.personality : '';
  lastSubmissions.push(row);
  if (!(f.elements.website && f.elements.website.value)) saveResult(config.resultsUrl, row); // the spam trap was left empty
  sent = { form: form.id, name: (row.full_name || '').split(' ')[0] };
  render();
  const box = page.querySelector('.success');
  if (box) { box.focus(); box.scrollIntoView({ block: 'center' }); }
}

function successBox() {
  const t = T(), box = h('div', 'success'); box.tabIndex = -1; box.setAttribute('role', 'status');
  box.appendChild(h('h3', null, fill(t.form.success.title, { name: sent.name || '' }).replace(' !', '!').replace(', !', '!')));
  box.appendChild(h('p', null, t.form.success.body));
  if (navigator.onLine === false) box.appendChild(h('p', 'muted', t.form.offline));
  const again = h('button', 'switch', t.form.success.again); again.type = 'button'; again.id = 'again';
  again.addEventListener('click', () => { sent = null; active = null; history.replaceState(null, '', location.pathname + location.search); render(); scrollToForms(); });
  box.appendChild(again);
  return box;
}

/* keep what the visitor typed when the language changes */
function readValues() {
  const f = page.querySelector('form.form'); if (!f) return null;
  const out = {};
  [...f.elements].forEach((el) => {
    if (!el.name) return;
    if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) (out[el.name] = out[el.name] || []).push(el.value); }
    else out[el.name] = el.value;
  });
  return out;
}
function writeValues(vals) {
  const f = page.querySelector('form.form'); if (!f || !vals) return;
  [...f.elements].forEach((el) => {
    if (!el.name || !(el.name in vals)) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = vals[el.name].includes(el.value);
    else el.value = vals[el.name];
  });
  f.dispatchEvent(new Event('change'));
}

/* ---------- the test, full screen on top of the page ---------- */
let lastFocus = null;
function openTest() {
  if (document.querySelector('.overlay')) return;
  lastFocus = document.activeElement;
  const ov = h('div', 'overlay'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', T().test.title);
  const frame = document.createElement('iframe');
  frame.src = 'test.html?embed=1&lang=' + lang; frame.title = T().test.title; frame.id = 'test-frame';
  frame.setAttribute('allow', 'autoplay');
  const bar = h('div', 'overlay-bar');
  bar.appendChild(h('b', null, T().test.title));
  const close = h('button', 'close', '<span aria-hidden="true">×</span> ' + T().test.close); close.type = 'button'; close.id = 'close-test';
  close.addEventListener('click', closeTest);
  bar.appendChild(close);
  ov.appendChild(bar); ov.appendChild(frame);
  document.body.appendChild(ov);
  document.body.classList.add('locked');
  frame.addEventListener('load', () => { try { frame.contentWindow.focus(); } catch (e) { /* not ready */ } });
  close.focus();
}
function closeTest() {
  const ov = document.querySelector('.overlay'); if (!ov) return;
  ov.remove(); document.body.classList.remove('locked');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTest(); });
function onTestMessage(e) {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'finder-result') return;
  fromTest = { stream: e.data.stream, personality: e.data.personality };
  if (e.data.lang && config.languages.includes(e.data.lang) && e.data.lang !== lang) { lang = e.data.lang; setLang(lang, false); }
  closeTest();
  choose('join-program');
}

// Hooks for the automated tests (tests/smoke.mjs).
window.__landing = { submissions: lastSubmissions, simulateTest: (stream, personality) => onTestMessage({ origin: location.origin, data: { type: 'finder-result', stream, personality, lang } }) };

start().catch((e) => {
  page.innerHTML = '<p class="loading">Could not load the page. Please reload.</p>';
  console.error(e);
});

const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && secure) navigator.serviceWorker.register('sw.js');
