// Program Finder app: welcome, questions, result. All text and points come from content/*.json.
import { buildQuestions, areaMax, lean, score, profile, nextStepKey, fill } from './scoring.js';
import { deckle, addRims, h, logos, labelBtn, phone, papered, dot } from './paper.js';
import { saveResult, flushQueue } from './save.js';
import { turn, stamp, soundOn, setSound, useRecording } from './sound.js';

const LETTERS = ['B', 'I', 'N', 'G', 'O'];
// The centre square: an eight-point star (khatam), the same in every language.
const STAR = '<svg class="star" viewBox="0 0 24 24" role="img" aria-label="free square"><path fill="currentColor" d="M12 1 L15.22 4.22 L19.78 4.22 L19.78 8.78 L23 12 L19.78 15.22 L19.78 19.78 L15.22 19.78 L12 23 L8.78 19.78 L4.22 19.78 L4.22 15.22 L1 12 L4.22 8.78 L4.22 4.22 L8.78 4.22Z"/><path fill="none" stroke="var(--burg)" stroke-width="1.2" d="M12 1 L15.22 4.22 L19.78 4.22 L19.78 8.78 L23 12 L19.78 15.22 L19.78 19.78 L15.22 19.78 L12 23 L8.78 19.78 L4.22 19.78 L4.22 15.22 L1 12 L4.22 8.78 L4.22 4.22 L8.78 4.22Z" transform="translate(12 12) scale(.62) translate(-12 -12)"/><circle cx="12" cy="12" r="2.2" fill="var(--burg)"/></svg>';

const root = document.getElementById('app');
const wide = window.matchMedia('(min-width: 900px) and (min-height: 560px) and (orientation: landscape)');

let config, questions, texts = {};
let lang, QS, MAX;
let step = -1, picks = [], timer = null, idle = null, saved = false;

async function loadJSON(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

async function start() {
  [config, questions] = await Promise.all([loadJSON('content/config.json'), loadJSON('content/questions.json')]);
  const loaded = await Promise.all(config.languages.map((l) => loadJSON('content/' + l + '.json')));
  config.languages.forEach((l, i) => { texts[l] = loaded[i]; });
  useRecording(config.pageTurnSound);
  const fromUrl = new URLSearchParams(location.search).get('lang');
  setLang(config.languages.includes(fromUrl) ? fromUrl : config.defaultLanguage);
  wide.addEventListener('change', () => render());
  flushQueue(config.resultsUrl);
  window.addEventListener('online', () => flushQueue(config.resultsUrl));
}

function setLang(l) {
  lang = l;
  QS = buildQuestions(config, questions, texts[lang], config.questionStyle);
  MAX = areaMax(config, QS);
  document.documentElement.lang = lang;
  document.documentElement.dir = config.rightToLeft.includes(lang) ? 'rtl' : 'ltr';
  render();
}

const T = () => texts[lang];

/* stamps on the bingo card: each answer stamps the line of the stream it leans to */
function cardState() {
  const stamped = {}, used = Object.fromEntries(config.streams.map((s) => [s, 0]));
  let f = 0;
  picks.forEach((k, i) => {
    const q = QS[i];
    if (k == null || !q || q.kind === 'practical') return;
    const a = q.answers[k], s = lean(config, a.points);
    if (!s) return;
    const n = q.kind === 'scale' ? config.scaleStamps[a.rating] : 1;
    for (let m = 0; m < n; m++) {
      const line = config.bingoLines[s];
      const key = used[s] < line.length ? line[used[s]++] : config.bingoFillers[f++ % config.bingoFillers.length];
      if (stamped[key] == null) stamped[key] = i;
    }
  });
  return stamped;
}

function bingoCard(big, win) {
  const t = T(), stamped = cardState(), answered = picks.filter((x) => x != null).length;
  const card = h('div', 'bcard' + (big ? ' big' : ''));
  card.appendChild(h('div', 'mycard-head', '<b>' + t.ui.yourCard + '</b><span>' + fill(t.ui.answered, { a: answered, n: QS.length }) + '</span>'));
  const grid = h('div', 'bgrid');
  LETTERS.forEach((L) => grid.appendChild(h('div', 'bhead', L)));
  const winSet = win ? config.bingoLines[win] : [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const key = r + '-' + c, free = r === 2 && c === 2, isWin = winSet.includes(key);
    const on = free || stamped[key] != null || isWin;
    const w = h('div', 'sqw' + ((isWin || (win && free)) ? ' win' : ''));
    w.appendChild(h('div', 'bc' + (free ? ' free' : ''), free ? STAR : (big ? t.cells[r][c] : '')));
    if (on && !free) w.appendChild(dot('var(--gold)'));
    grid.appendChild(w);
  }
  card.appendChild(grid);
  return card;
}

function soundToggle() {
  const on = soundOn(), b = h('button', 'sound-toggle', on ? SPEAKER_ON : SPEAKER_OFF);
  b.type = 'button'; b.id = 'sound'; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', T().ui.sound || 'Sound');
  b.addEventListener('click', () => { setSound(!soundOn()); if (soundOn()) turn(); render(); });
  return b;
}
const SPEAKER_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SPEAKER_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9l6 6M22 9l-6 6"/></svg>';

function langChips() {
  const box = h('div', 'lang-chips');
  const names = { en: ['EN', 'English'], tr: ['TR', 'Türkçe'], ar: ['ع', 'العربية'] };
  config.languages.forEach((l) => {
    const n = names[l] || [l.toUpperCase(), l];
    const b = h('button', null, n[0]);
    b.type = 'button'; b.id = 'lang-' + l; b.setAttribute('aria-label', n[1]); b.setAttribute('aria-pressed', String(l === lang));
    b.addEventListener('click', () => setLang(l));
    box.appendChild(b);
  });
  box.appendChild(soundToggle());
  return box;
}

/* personality: a torn bingo ticket stub with the type number, name, one line and the top 3 strengths */
function ticket(pr) {
  const t = T(), i0 = config.areas.indexOf(pr.type), type = t.personality.types[pr.type];
  const tw = h('div', 'pt-wrap'), tk = h('div', 'pt');
  tk.appendChild(h('div', 'pt-no', '<span>' + t.ui.ticketNo + '</span><b>' + String(i0 + 1).padStart(2, '0') + '</b>'));
  const body = h('div', 'pt-body');
  body.appendChild(h('p', 'pb-type', type.name));
  body.appendChild(h('p', 'pb-desc', type.line));
  const row = h('div', 'pt-strengths');
  pr.top.forEach((d) => {
    const it = h('span', 'pt-s'), hole = h('i', 'pt-hole');
    hole.appendChild(h('span', 'pb-mark pb-ring'));
    it.appendChild(hole); it.appendChild(h('span', null, t.personality.areas[d]));
    row.appendChild(it);
  });
  body.appendChild(row); tk.appendChild(body);
  deckle(tk, 1.3, 'rl'); tw.appendChild(tk);
  return tw;
}

/* enter: 'fwd' when moving on (the new sheet settles from underneath), 'back' when going back
   (the previous sheet is laid back on top), or nothing for an instant redraw (language, rotation). */
function render(enter) {
  clearTimeout(timer); clearTimeout(idle);
  const t = T(), tab = wide.matches, p = phone(false);
  if (enter) p.classList.add('enter-' + enter);
  let c = p.c, R = null;
  p.setAttribute('lang', lang); p.dir = document.documentElement.dir;
  if (tab) {
    p.classList.add('tablet'); c.classList.add('split');
    const Lc = h('div', 'col-l'); R = h('div', 'col-r');
    c.appendChild(Lc); c.appendChild(R); c = Lc;
  }
  if (step < 0) {
    const top = h('div', 'welcome-top'); top.innerHTML = logos(); top.appendChild(langChips()); c.appendChild(top);
    const bw = h('div', 'bingo-word');
    LETTERS.forEach((L, i) => { const w = h('div', 'sqw'), b = h('div', 'bl', L); deckle(b, 1); w.appendChild(b); if (i === 3) w.appendChild(dot('var(--gold)')); bw.appendChild(w); });
    c.appendChild(bw);
    c.appendChild(h('h1', 'title', t.ui.title));
    c.appendChild(h('p', 'lede', t.ui.lede));
    c.appendChild(h('div', 'spacer'));
    const bt = labelBtn(t.ui.begin); bt.id = 'begin';
    bt.querySelector('button').addEventListener('click', () => { picks = []; saved = false; advance(p); });
    c.appendChild(bt);
    c.appendChild(h('p', 'fine', fill(t.ui.fine, { n: QS.length })));
    if (config.draftLanguages.includes(lang) && t.ui.draftNote) c.appendChild(h('p', 'draft', t.ui.draftNote));
    if (tab) { R.appendChild(bingoCard(true)); R.appendChild(h('p', 'card-hint', t.ui.cardHint)); }
  } else if (step < QS.length) {
    const Q = QS[step], chosen = picks[step];
    c.appendChild(h('p', 'q-prompt', fill(t.ui.questionOf, { i: step + 1, n: QS.length }) + (Q.kind === 'practical' ? t.ui.practicalNote : '')));
    if (Q.kind === 'scale') {
      c.appendChild(h('p', 'q-ask', t.ui.scaleAsk));
      const qt = lang === 'ar' ? '«' + Q.q + '»' : '“' + Q.q + '”';
      c.appendChild(h('h2', 'q-big q-stmt', qt));
    } else {
      c.appendChild(h('h2', 'q-big', Q.q));
    }
    const grid = h('div', 'sq-grid' + (Q.kind === 'scale' ? ' scale' : ''));
    grid.setAttribute('role', 'group');
    Q.answers.forEach((a, i) => {
      const w = h('div', 'sq ink' + (chosen === i ? ' on' : '')), b = h('button');
      b.type = 'button'; b.id = 'ans-' + i; b.setAttribute('aria-pressed', String(chosen === i));
      b.innerHTML = '<span class="letter" aria-hidden="true">' + LETTERS[i] + '</span><span class="ans">' + a.label + '</span>';
      deckle(b, 1.2, i === 4 ? 'r' : 'rb');
      if (i === 4) w.classList.add('wide');
      b.addEventListener('click', () => pick(i, grid));
      w.appendChild(b); w.appendChild(h('span', 'ink-ring', t.ui.thatsMe));
      grid.appendChild(w);
    });
    c.appendChild(grid);
    c.appendChild(h('div', 'spacer'));
    if (tab) R.appendChild(bingoCard(true)); else c.appendChild(bingoCard(false));
    const nb = labelBtn(step === QS.length - 1 ? t.ui.seeMatch : t.ui.next); nb.id = 'next-wrap';
    nb.querySelector('button').disabled = chosen == null; nb.style.opacity = chosen == null ? '.45' : '1';
    nb.querySelector('button').addEventListener('click', () => { if (picks[step] != null) advance(p); });
    c.appendChild(nb);
    if (step > 0) {
      const back = h('button', 'restart', t.ui.back); back.type = 'button'; back.id = 'back';
      back.addEventListener('click', () => { turn(); step--; render('back'); });
      c.appendChild(back);
    }
  } else {
    const res = score(config, QS, picks, MAX), win = res.win, name = t.streams[win], pr = profile(config, res);
    const top = h('div'); top.innerHTML = logos(); c.appendChild(top.firstChild); c.appendChild(top.lastChild);
    c.appendChild(h('p', 'res-k', t.ui.yourMatch));
    c.appendChild(h('h1', 'res-name' + (name.length > 12 ? ' long' : ''), name));
    c.appendChild(ticket(pr));
    const card = bingoCard(true, win); card.appendChild(papered('banner', 'banner-wrap', 'BINGO!', 1.2));
    (tab ? R : c).appendChild(card);
    c.appendChild(h('div', 'spacer'));
    const key = nextStepKey(config, QS, picks, win);
    c.appendChild(papered('next-card', 'next-wrap', '<b>' + t.ui.nextStep + '</b><span>' + fill(t.steps[key], { stream: name }) + '</span>', 1.4));
    const so = labelBtn(t.ui.startOver); so.id = 'start-over';
    so.querySelector('button').addEventListener('click', () => restart(true));
    c.appendChild(so);
    c.appendChild(h('p', 'idle', fill(t.ui.idle, { s: config.idleSeconds })));
    idle = setTimeout(restart, config.idleSeconds * 1000);
    p.classList.add('result');
    p.dataset.win = win; p.dataset.type = pr.type;
    if (!saved) {
      saved = true;
      saveResult(config.resultsUrl, {
        time: new Date().toISOString(), lang, style: config.questionStyle,
        answers: QS.map((q, i) => q.id + '=' + (picks[i] == null ? '' : q.answers[picks[i]].id)).join(' '),
        stream: win, personality: pr.type, strengths: pr.top.join(' '), nextStep: key,
        scores: config.streams.map((s) => s + ':' + res.scores[s].toFixed(3)).join(' '),
      });
    }
  }
  root.innerHTML = ''; root.appendChild(p); addRims(root);
}

function pick(i, grid) {
  if (picks[step] !== i) stamp();
  picks[step] = i;
  [...grid.children].forEach((w, j) => { w.classList.toggle('on', j === i); w.querySelector('button').setAttribute('aria-pressed', String(j === i)); });
  const nb = root.querySelector('#next-wrap');
  if (nb) { nb.querySelector('button').disabled = false; nb.style.opacity = '1'; }
}

/* Moving on, like turning a page in a book: the next page is drawn underneath, and a copy of the old
   page is laid on top of it. That copy turns over on its spine (the left edge, or the right edge in Arabic),
   shows the plain back of the paper as it goes, and lands face down beside the book. */
const TURN_MS = 1150;
let turning = null;
function advance(p) {
  if (turning) turning.remove(); // a quick second tap finishes the previous turn at once
  turn();
  const old = p.querySelector('.layer.top');
  const book = h('div', 'book');
  const leaf = h('div', 'leaf');
  const front = h('div', 'leaf-face leaf-front'); front.appendChild(old.cloneNode(true)); front.appendChild(h('div', 'leaf-shade'));
  const backPage = old.cloneNode(true); const bc = backPage.querySelector('.content'); if (bc) bc.innerHTML = '';
  const back = h('div', 'leaf-face leaf-back'); back.appendChild(backPage); back.appendChild(h('div', 'leaf-shade'));
  leaf.appendChild(front); leaf.appendChild(back);
  book.appendChild(h('div', 'leaf-gutter'));
  book.appendChild(leaf);
  // the copy is only a picture of the old page: no duplicate ids, nothing to tap or read out
  book.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  book.setAttribute('aria-hidden', 'true'); book.inert = true;
  step++;
  render('under');
  root.querySelector('.phone').appendChild(book);
  turning = book;
  const done = () => { book.remove(); if (turning === book) turning = null; };
  leaf.addEventListener('animationend', (e) => { if (e.target === leaf) done(); });
  setTimeout(() => { if (book.isConnected) done(); }, TURN_MS + 400); // safety net, e.g. when motion is reduced
}

function restart(fromButton) { if (fromButton === true) turn(); step = -1; picks = []; saved = false; render('fwd'); }

// Hooks for the automated tests (tests/smoke.mjs).
window.__finder = { score: (pk) => score(config, QS, pk, MAX), questions: () => QS, setLang: (l) => setLang(l) };

start().catch((e) => {
  root.innerHTML = '<p class="loading">Could not load the survey. Please reload the page.</p>';
  console.error(e);
});

const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && secure) navigator.serviceWorker.register('sw.js');
