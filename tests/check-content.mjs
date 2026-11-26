// Content check: run with `node tests/check-content.mjs` (or `npm run check`).
// It fails (exit code 1) if a change to content/ would break the survey, and prints how often
// each stream wins across every possible set of answers.
import { readFileSync } from 'node:fs';
import { buildQuestions, areaMax, lean, score } from '../src/scoring.js';

const dir = new URL('../content/', import.meta.url);
const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

function load(name) {
  try { return JSON.parse(readFileSync(new URL(name, dir), 'utf8')); }
  catch (e) { err(`content/${name}: cannot be read as JSON (${e.message})`); return null; }
}

const config = load('config.json');
const questions = load('questions.json');
if (!config || !questions) finish();

/* ---------- config ---------- */
const areas = config.areas || [];
const streams = config.streams || [];
if (!['scale', 'choices'].includes(config.questionStyle)) err(`config.json: questionStyle must be "scale" or "choices", not "${config.questionStyle}"`);
if (!config.languages?.includes(config.defaultLanguage)) err('config.json: defaultLanguage must be one of languages');
const sums = new Set();
for (const s of streams) {
  const row = config.matrix?.[s];
  if (!row) { err(`config.json: matrix has no row for stream ${s}`); continue; }
  for (const d of areas) {
    const v = row[d];
    if (!Number.isInteger(v) || v < 0 || v > 3) err(`config.json: matrix ${s}.${d} must be a whole number from 0 to 3 (found ${v})`);
  }
  for (const k of Object.keys(row)) if (!areas.includes(k)) err(`config.json: matrix ${s} has unknown area "${k}"`);
  sums.add(areas.reduce((a, d) => a + (row[d] || 0), 0));
}
if (sums.size > 1) err(`config.json: every matrix row must add up to the same total (found ${[...sums].join(', ')}). Use 10 for each.`);
if ([...streams].sort().join() !== [...(config.tieOrder || [])].sort().join()) err('config.json: tieOrder must list every stream once');
const usedCells = new Set();
for (const s of streams) {
  const line = config.bingoLines?.[s] || [];
  if (line.length !== 4) err(`config.json: bingoLines.${s} needs 4 cells`);
  for (const c of line) {
    if (!/^[0-4]-[0-4]$/.test(c) || c === '2-2') err(`config.json: bingoLines.${s} has a bad cell "${c}"`);
    if (usedCells.has(c)) err(`config.json: cell ${c} is used by two bingo lines`);
    usedCells.add(c);
  }
}
if (!(config.idleSeconds >= 10)) err('config.json: idleSeconds should be at least 10');
if (config.resultsUrl && !/^https:\/\/script\.google\.com\//.test(config.resultsUrl)) warn('config.json: resultsUrl does not look like a Google Apps Script web app address');

/* ---------- questions ---------- */
const checkPoints = (where, pts) => {
  const keys = Object.keys(pts || {});
  if (!keys.length) err(`${where}: has no points`);
  for (const k of keys) {
    if (!areas.includes(k)) err(`${where}: unknown area "${k}" (use one of ${areas.join(', ')})`);
    if (!Number.isInteger(pts[k]) || pts[k] < 1 || pts[k] > 3) err(`${where}: points for ${k} must be 1, 2 or 3`);
  }
  if (lean(config, pts || {}) == null) err(`${where}: its points do not count for any stream`);
};
const ids = new Set();
for (const q of questions.choices || []) {
  if (ids.has(q.id)) err(`questions.json: duplicate question id "${q.id}"`); ids.add(q.id);
  if (q.answers.length < 2 || q.answers.length > 5) err(`questions.json: ${q.id} needs 2 to 5 answers (the squares are B, I, N, G, O)`);
  const aids = new Set();
  for (const a of q.answers) {
    if (aids.has(a.id)) err(`questions.json: ${q.id} has a duplicate answer id "${a.id}"`); aids.add(a.id);
    checkPoints(`questions.json: ${q.id}/${a.id}`, a.points);
  }
}
for (const st of questions.statements || []) {
  if (ids.has(st.id)) err(`questions.json: duplicate id "${st.id}"`); ids.add(st.id);
  checkPoints(`questions.json: statement ${st.id}`, st.points);
}
const practical = Object.fromEntries((questions.practical || []).map((p) => [p.id, p.answers]));
const r = config.rules || {};
for (const [list, q] of [['lowTimeAnswers', r.timeQuestion], ['under18Answers', r.ageQuestion], ['over35Answers', r.ageQuestion]]) {
  if (!practical[q]) { err(`config.json: rules refer to a missing practical question "${q}"`); continue; }
  for (const a of r[list] || []) if (!practical[q].includes(a)) err(`config.json: rules.${list} has "${a}", which is not an answer of ${q}`);
}

/* ---------- languages ---------- */
const texts = {};
for (const l of config.languages || []) texts[l] = load(`${l}.json`);
const en = texts.en || texts[config.defaultLanguage];
const placeholders = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(' ');
function compare(ref, other, path, lang) {
  if (typeof ref === 'string') {
    if (typeof other !== 'string' || !other.trim()) { if (!(path.endsWith('draftNote'))) err(`${lang}.json: "${path}" is missing or empty`); return; }
    if (placeholders(ref) !== placeholders(other)) err(`${lang}.json: "${path}" must keep the placeholders ${placeholders(ref) || '(none)'}`);
    return;
  }
  if (Array.isArray(ref)) {
    if (!Array.isArray(other) || other.length !== ref.length) { err(`${lang}.json: "${path}" must be a list of ${ref.length}`); return; }
    ref.forEach((v, i) => compare(v, other[i], `${path}[${i}]`, lang));
    return;
  }
  if (ref && typeof ref === 'object') {
    if (!other || typeof other !== 'object') { err(`${lang}.json: "${path}" is missing`); return; }
    for (const k of Object.keys(ref)) compare(ref[k], other[k], path ? `${path}.${k}` : k, lang);
    for (const k of Object.keys(other)) if (!(k in ref)) warn(`${lang}.json: "${path ? path + '.' : ''}${k}" is not in en.json and is ignored`);
  }
}
if (en) {
  // en.json must have text for every id in questions.json
  for (const q of questions.choices || []) {
    const t = en.choices?.[q.id];
    if (!t) { err(`en.json: no text for question "${q.id}"`); continue; }
    for (const a of q.answers) if (!t.answers?.[a.id]) err(`en.json: no text for answer ${q.id}/${a.id}`);
  }
  for (const st of questions.statements || []) if (!en.statements?.[st.id]) err(`en.json: no text for statement "${st.id}"`);
  for (const [qid, ans] of Object.entries(practical)) for (const a of ans) if (!en.practical?.[qid]?.answers?.[a]) err(`en.json: no text for ${qid}/${a}`);
  for (const d of areas) if (!en.personality?.types?.[d] || !en.personality?.areas?.[d]) err(`en.json: personality is missing area "${d}"`);
  for (const s of streams) if (!en.streams?.[s]) err(`en.json: no name for stream ${s}`);
  if (en.cells?.length !== 5 || en.cells.some((row) => row.length !== 5)) err('en.json: cells must be 5 rows of 5');
  if (en.scale?.length !== 4) err('en.json: scale must have 4 labels');
  for (const [l, t] of Object.entries(texts)) if (t && t !== en) compare(en, t, '', l);
}

/* ---------- simulation: every possible set of answers ---------- */
function simulate(style) {
  const qs = buildQuestions(config, questions, en, style).filter((q) => q.kind !== 'practical');
  const max = areaMax(config, qs);
  const wins = Object.fromEntries(streams.map((s) => [s, 0]));
  const picks = new Array(qs.length).fill(0);
  let n = 0;
  const total = qs.reduce((a, q) => a * q.answers.length, 1);
  const stride = total > 2e6 ? Math.ceil(total / 2e6) : 1; // sample evenly if huge
  for (let idx = 0; idx < total; idx += stride) {
    let x = idx;
    for (let i = qs.length - 1; i >= 0; i--) { picks[i] = x % qs[i].answers.length; x = Math.floor(x / qs[i].answers.length); }
    wins[score(config, qs, picks, max).win]++; n++;
  }
  return { n, share: Object.fromEntries(streams.map((s) => [s, (wins[s] / n) * 100])) };
}

/* ---------- website: forms.json and landing.<lang>.json ---------- */
const forms = load('forms.json');
const landing = Object.fromEntries((config.languages || []).map((l) => [l, load(`landing.${l}.json`)]));
if (forms && landing.en) {
  const TYPES = ['text', 'email', 'tel', 'url', 'select', 'textarea', 'checkboxes', 'radios'];
  const sheets = new Set(), allFields = [...(forms.shared || [])];
  for (const f of forms.forms || []) {
    if (!/^[a-z][a-z-]*$/.test(f.id || '') || !f.sheet) err('forms.json: every form needs an id (lower case letters and -) and a sheet name');
    if (sheets.has(f.sheet)) err(`forms.json: two forms write to the sheet "${f.sheet}"`);
    sheets.add(f.sheet);
    const own = new Set((forms.shared || []).map((x) => x.id));
    for (const fd of f.fields || []) {
      if (own.has(fd.id)) err(`forms.json: ${f.id} has the field "${fd.id}" twice`);
      own.add(fd.id); allFields.push(fd);
    }
  }
  if (sheets.has('Results')) err('forms.json: the "Results" tab is kept for the test; use another sheet name');
  const APPS = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  for (const f of forms.forms || []) if (!APPS.includes(`'${f.id}': '${f.sheet}'`)) err(`apps-script/Code.gs: FORM_SHEETS must contain '${f.id}': '${f.sheet}' (then publish a new version of the script)`);
  for (const fd of allFields) {
    if (!/^[a-z][a-z0-9_]*$/.test(fd.id || '')) err(`forms.json: field id "${fd.id}" must be lower case letters, digits and _`);
    if (!TYPES.includes(fd.type)) err(`forms.json: field ${fd.id} has unknown type "${fd.type}" (use ${TYPES.join(', ')})`);
    if (['select', 'checkboxes', 'radios'].includes(fd.type) && !(fd.options || []).length) err(`forms.json: field ${fd.id} needs options`);
  }
  // every text a visitor can see, in every language
  const need = ['links.learnMore'];
  for (const f of forms.forms || []) {
    need.push(`forms.${f.id}.title`, `forms.${f.id}.line`);
    for (const fd of (forms.shared || []).concat(f.fields || [])) {
      need.push(landing.en.forms?.[f.id]?.labels?.[fd.id] ? `forms.${f.id}.labels.${fd.id}` : `fields.${fd.id}.label`);
      for (const o of fd.options || []) need.push(`options.${fd.id}.${o}`);
    }
  }
  for (const s of streams) need.push(`streams.${s}.name`, `streams.${s}.line`, `streams.${s}.time`);
  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const leaves = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? leaves(v, p + k + '.') : [[p + k, v]]));
  const holes = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
  for (const l of config.languages || []) {
    const t = landing[l]; if (!t) continue;
    for (const k of need) { const v = get(t, k); if (typeof v !== 'string' || !v.trim()) err(`landing.${l}.json: missing text for ${k}`); }
    if (!/^https:\/\//.test(get(t, 'links.learnMore') || '')) err(`landing.${l}.json: links.learnMore must be a full https:// address`);
    if (l === 'en') continue;
    for (const [k, v] of leaves(landing.en)) {
      const mine = get(t, k);
      if (mine === undefined) { err(`landing.${l}.json: missing ${k}`); continue; }
      if (typeof v === 'string' && holes(v) !== holes(mine)) err(`landing.${l}.json: ${k} must keep the placeholders ${holes(v) || '(none)'}`);
      if (Array.isArray(v) && (!Array.isArray(mine) || mine.length !== v.length)) err(`landing.${l}.json: ${k} must have ${v.length} items`);
    }
  }
}

if (!errors.length && en) {
  for (const style of ['choices', 'scale']) {
    const { n, share } = simulate(style);
    const mark = style === config.questionStyle ? ' (in use)' : '';
    console.log(`${style}${mark}: ${n.toLocaleString('en-US')} answer sets → ` + streams.map((s) => `${en.streams[s]} ${share[s].toFixed(1)}%`).join(', '));
    for (const s of streams) {
      if (share[s] < 5) (style === config.questionStyle ? err : warn)(`${style}: ${en.streams[s]} wins only ${share[s].toFixed(1)}% of answer sets (should be at least 5%)`);
    }
  }
}
finish();

function finish() {
  for (const w of warnings) console.log('warning: ' + w);
  if (errors.length) {
    for (const e of errors) console.log('ERROR: ' + e);
    console.log(`\n${errors.length} problem(s) found. Fix them before merging.`);
    process.exit(1);
  }
  console.log('Content check passed.');
  process.exit(0);
}
