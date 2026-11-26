// Form page (form.html?f=<form id>): one of the three website forms from content/forms.json.
// Labels come from content/landing.<lang>.json; a form can give a field its own label under forms.<id>.labels.
// Arriving from the test (…&match=I&type=<personality>) shows the match and saves it with the form.
// Sends to the same Google Apps Script as the test, which writes each form to its own tab.
import { h, ARROW, fill, loadSite, applyLang, href, topbar, footer, registerWorker } from './site.js';
import { saveResult, flushQueue } from './save.js';

const page = document.getElementById('page');
const q = new URLSearchParams(location.search);
let site, lang, form, sent = null;
const submissions = []; // read by the automated tests

function render() {
  const { config, texts } = site, t = texts[lang];
  const values = readValues();
  applyLang(config, t, lang);
  page.innerHTML = '';
  page.appendChild(topbar(config, t, lang, (l) => { lang = l; render(); }, true));
  const main = h('main', 'form-page'); main.id = 'main';
  if (!form) {
    document.title = t.meta.title;
    main.appendChild(h('h1', null, t.form.unknown));
    const a = h('a', 'btn primary', t.nav.back); a.href = href('index.html', lang); main.appendChild(a);
    page.appendChild(main); page.appendChild(footer(t));
    return;
  }
  const ft = t.forms[form.id];
  document.title = ft.title + ' · ' + t.nav.home;
  const head = h('header', 'form-head');
  head.appendChild(h('p', 'eyebrow', t.journey.eyebrow));
  head.appendChild(h('h1', null, ft.title));
  head.appendChild(h('p', 'lede', ft.line));
  main.appendChild(head);
  main.appendChild(sent ? successBox(t) : buildForm(t, ft));
  if (config.draftLanguages.includes(lang) && t.draftNote) main.appendChild(h('p', 'draft', t.draftNote));
  page.appendChild(main);
  page.appendChild(footer(t));
  writeValues(values);
}

const fieldsOf = () => site.forms.shared.concat(form.fields);
const labelOf = (t, ft, id) => ({ ...(t.fields[id] || { label: id }), ...(ft.labels && ft.labels[id] ? { label: ft.labels[id] } : {}) });
const testMatch = () => (site.config.streams.includes(q.get('match')) ? q.get('match') : null);

function buildForm(t, ft) {
  const f = h('form', 'form'); f.id = 'form-' + form.id; f.noValidate = true;
  const match = form.id === 'join-program' && testMatch();
  if (match) f.appendChild(h('p', 'from-test', fill(t.form.fromTest, { stream: t.streams[match].name })));
  fieldsOf().forEach((fd) => f.appendChild(buildField(t, labelOf(t, ft, fd.id), fd)));
  // spam trap: people never see or fill this
  const trap = h('div', 'trap'); trap.setAttribute('aria-hidden', 'true');
  trap.innerHTML = '<label>Website<input name="website" tabindex="-1" autocomplete="off"></label>';
  f.appendChild(trap);
  const consent = h('div', 'field consent-field'); consent.dataset.field = 'consent';
  consent.innerHTML = '<label class="consent"><input type="checkbox" name="consent" id="f-consent"> <span>' + t.form.consent + '</span></label><p class="err" id="err-consent" hidden></p>';
  f.appendChild(consent);
  f.appendChild(h('p', 'privacy', t.form.privacy));
  const summary = h('p', 'summary'); summary.setAttribute('role', 'alert'); summary.hidden = true; f.appendChild(summary);
  const send = h('button', 'btn primary', '<span>' + t.form.submit + '</span>' + ARROW); send.type = 'submit'; send.id = 'send';
  f.appendChild(send);
  f.addEventListener('submit', (e) => { e.preventDefault(); submit(t, f); });
  return f;
}

function buildField(t, label, fd) {
  const id = 'f-' + fd.id, wrap = h('div', 'field'); wrap.dataset.field = fd.id;
  const opt = fd.required ? '' : ' <span class="opt">(' + t.form.optional + ')</span>';
  const hint = label.hint ? '<span class="hint" id="hint-' + fd.id + '">' + label.hint + '</span>' : '';
  if (fd.type === 'checkboxes' || fd.type === 'radios') {
    const set = h('fieldset', 'set', '<legend>' + label.label + opt + '</legend>' + hint);
    const box = h('div', 'set-options');
    fd.options.forEach((o) => {
      const l = h('label', 'pick'), inp = document.createElement('input');
      inp.type = fd.type === 'radios' ? 'radio' : 'checkbox'; inp.name = fd.id; inp.value = o; inp.id = id + '-' + o;
      l.appendChild(inp); l.appendChild(h('span', null, (t.options?.[fd.id] || {})[o] || o));
      box.appendChild(l);
    });
    set.appendChild(box); wrap.appendChild(set);
  } else {
    const lab = h('label', null, label.label + opt); lab.htmlFor = id; wrap.appendChild(lab);
    if (hint) wrap.insertAdjacentHTML('beforeend', hint);
    let c;
    if (fd.type === 'textarea') { c = document.createElement('textarea'); c.rows = 5; }
    else if (fd.type === 'select') {
      c = document.createElement('select');
      c.appendChild(new Option(t.form.choose, ''));
      fd.options.forEach((o) => c.appendChild(new Option((t.options?.[fd.id] || {})[o] || o, o)));
    } else {
      c = document.createElement('input'); c.type = fd.type;
      if (fd.type === 'email') c.inputMode = 'email';
      if (fd.type === 'tel') { c.inputMode = 'tel'; c.dir = 'ltr'; }
      if (fd.type === 'url') { c.inputMode = 'url'; c.dir = 'ltr'; c.placeholder = 'https://'; }
    }
    c.id = id; c.name = fd.id;
    if (fd.autocomplete) c.autocomplete = fd.autocomplete;
    if (fd.required) c.setAttribute('aria-required', 'true');
    if (hint) c.setAttribute('aria-describedby', 'hint-' + fd.id);
    wrap.appendChild(c);
  }
  const err = h('p', 'err'); err.id = 'err-' + fd.id; err.hidden = true; wrap.appendChild(err);
  return wrap;
}

function valueOf(f, fd) {
  if (fd.type === 'checkboxes') return [...f.querySelectorAll('[name="' + fd.id + '"]:checked')].map((x) => x.value);
  if (fd.type === 'radios') return (f.querySelector('[name="' + fd.id + '"]:checked') || {}).value || '';
  return (f.elements[fd.id]?.value || '').trim();
}

function validate(t, f) {
  const bad = [];
  const mark = (id, msg) => {
    const e = f.querySelector('#err-' + id); e.textContent = msg || ''; e.hidden = !msg;
    f.querySelector('[data-field="' + id + '"]').classList.toggle('invalid', !!msg);
    f.querySelectorAll('[name="' + id + '"]').forEach((c) => { c.setAttribute('aria-invalid', String(!!msg)); if (msg) c.setAttribute('aria-errormessage', 'err-' + id); });
    if (msg) bad.push(id);
  };
  fieldsOf().forEach((fd) => {
    const v = valueOf(f, fd), empty = Array.isArray(v) ? !v.length : v === '';
    if (fd.required && empty) return mark(fd.id, t.form.missing);
    if (!empty && fd.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return mark(fd.id, t.form.badEmail);
    if (!empty && fd.type === 'tel' && (v.match(/\d/g) || []).length < 7) return mark(fd.id, t.form.badPhone);
    if (!empty && fd.type === 'url' && !/^https?:\/\/\S+\.\S+/.test(v)) return mark(fd.id, t.form.badUrl);
    mark(fd.id, '');
  });
  mark('consent', f.querySelector('#f-consent').checked ? '' : t.form.missing);
  return bad;
}

function submit(t, f) {
  const bad = validate(t, f), summary = f.querySelector('.summary');
  if (bad.length) {
    summary.textContent = t.form.fixErrors; summary.hidden = false;
    f.querySelector('[name="' + bad[0] + '"]')?.focus();
    return;
  }
  summary.hidden = true;
  const en = site.texts.en, match = form.id === 'join-program' ? testMatch() : null;
  // the sheet gets English option text, whatever language the visitor used
  const row = { form: form.id, sheet: form.sheet, time: new Date().toISOString(), lang };
  fieldsOf().forEach((fd) => {
    const v = valueOf(f, fd), word = (o) => (en.options?.[fd.id] || {})[o] || o;
    row[fd.id] = Array.isArray(v) ? v.map(word).join(', ') : fd.options ? (v ? word(v) : '') : v;
  });
  if (match) { row.testMatch = en.streams[match].name; row.testPersonality = q.get('type') || ''; }
  if (f.elements.website.value) row.website = f.elements.website.value; // the spam trap; the script drops these rows
  submissions.push(row);
  saveResult(site.config.resultsUrl, row);
  sent = { name: row.full_name.split(/\s+/)[0] };
  render();
  page.querySelector('.success')?.focus();
  scrollTo(0, 0);
}

function successBox(t) {
  const box = h('div', 'success'); box.tabIndex = -1; box.setAttribute('role', 'status');
  box.appendChild(h('h2', null, fill(t.form.success.title, { name: sent.name })));
  box.appendChild(h('p', null, t.form.success.body));
  if (navigator.onLine === false) box.appendChild(h('p', 'muted', t.form.offline));
  const home = h('a', 'btn secondary', t.form.success.home); home.href = href('index.html', lang); home.id = 'home';
  box.appendChild(home);
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
}

window.__site = { submissions };

loadSite().then((s) => {
  site = s; lang = s.lang;
  form = s.forms.forms.find((x) => x.id === q.get('f')) || null;
  render();
  flushQueue(s.config.resultsUrl);
  addEventListener('online', () => flushQueue(s.config.resultsUrl));
}).catch((e) => {
  page.innerHTML = '<p class="loading">Could not load the page. Please reload.</p>';
  console.error(e);
});
registerWorker();
