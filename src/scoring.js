// Scoring for the Program Finder. Pure functions, no DOM: used by the site and by tests/check-content.mjs.
//
// How a match is made (see README.md for the plain-language version):
//   1. Each answer adds points to one or two of the 8 areas.
//   2. Each area's total is divided by the most anyone could score there (0 to 100%).
//   3. Those percentages are multiplied by each stream's weights in the matrix and added up.
//   4. The highest total wins. A tie goes to the stream whose strongest areas scored higher,
//      then to the fixed tie order in content/config.json.

/** Build the active question list for one language and question style. */
export function buildQuestions(config, questions, text, style) {
  const qs = [];
  if (style === 'scale') {
    for (const st of questions.statements) {
      qs.push({
        id: st.id,
        kind: 'scale',
        q: text.statements[st.id],
        answers: text.scale.map((label, r) => ({ id: String(r), label, points: scalePoints(st.points, r), rating: r })),
      });
    }
  } else {
    for (const ch of questions.choices) {
      const t = text.choices[ch.id];
      qs.push({
        id: ch.id,
        kind: 'choice',
        q: t.q,
        answers: ch.answers.map((a) => ({ id: a.id, label: t.answers[a.id], points: a.points })),
      });
    }
  }
  for (const pq of questions.practical) {
    const t = text.practical[pq.id];
    qs.push({ id: pq.id, kind: 'practical', q: t.q, answers: pq.answers.map((id) => ({ id, label: t.answers[id], points: {} })) });
  }
  return qs;
}

function scalePoints(points, rating) {
  const out = {};
  for (const k in points) out[k] = points[k] * rating;
  return out;
}

/** The most anyone could score in each area with this question list. */
export function areaMax(config, qs) {
  const m = Object.fromEntries(config.areas.map((d) => [d, 0]));
  for (const q of qs) for (const d of config.areas) m[d] += Math.max(0, ...q.answers.map((a) => a.points[d] || 0));
  return m;
}

/** Which stream an answer leans to (used for stamping the bingo card). Null if it adds no points. */
export function lean(config, points) {
  let best = null, bv = 0;
  for (const s of config.streams) {
    let v = 0;
    for (const k in points) v += points[k] * config.matrix[s][k];
    if (v > bv) { bv = v; best = s; }
  }
  return best;
}

/**
 * Score a set of picks. picks[i] is the index of the chosen answer for qs[i], or null.
 * Returns { scores, win, pct } where pct is the visitor's 0..1 profile per area.
 */
export function score(config, qs, picks, max = areaMax(config, qs)) {
  const tot = Object.fromEntries(config.areas.map((d) => [d, 0]));
  picks.forEach((k, i) => {
    if (k == null || !qs[i]) return;
    const p = qs[i].answers[k].points;
    for (const d in p) tot[d] += p[d];
  });
  const pct = Object.fromEntries(config.areas.map((d) => [d, max[d] ? tot[d] / max[d] : 0]));
  const scores = {};
  for (const s of config.streams) {
    const row = config.matrix[s];
    const sum = config.areas.reduce((a, d) => a + row[d], 0);
    scores[s] = config.areas.reduce((a, d) => a + pct[d] * row[d], 0) / sum;
  }
  const core = (s) => {
    const row = config.matrix[s], top = Math.max(...config.areas.map((d) => row[d]));
    return config.areas.reduce((a, d) => a + (row[d] === top ? pct[d] : 0), 0);
  };
  const win = [...config.streams].sort((a, b) => {
    if (Math.abs(scores[b] - scores[a]) > 1e-9) return scores[b] - scores[a];
    if (Math.abs(core(b) - core(a)) > 1e-9) return core(b) - core(a);
    return config.tieOrder.indexOf(a) - config.tieOrder.indexOf(b);
  })[0];
  return { scores, win, pct };
}

/**
 * Personality: areas ranked by the visitor's percentage (ties keep the order in config.areas).
 * If nothing scored at all, the type comes from the matched stream's main area.
 */
export function profile(config, result) {
  const areas = config.areas;
  let ranked = [...areas].sort((a, b) => (result.pct[b] - result.pct[a]) || (areas.indexOf(a) - areas.indexOf(b)));
  if (!result.pct[ranked[0]]) {
    const row = config.matrix[result.win], top = Math.max(...areas.map((d) => row[d]));
    const main = areas.find((d) => row[d] === top);
    ranked = [main, ...ranked.filter((d) => d !== main)];
  }
  return { type: ranked[0], top: ranked.slice(0, 3) };
}

/** Which next-step message applies, from the practical answers. */
export function nextStepKey(config, qs, picks, win) {
  const r = config.rules;
  const ans = (qid) => {
    const i = qs.findIndex((q) => q.id === qid);
    return i > -1 && picks[i] != null ? qs[i].answers[picks[i]].id : null;
  };
  const age = ans(r.ageQuestion), time = ans(r.timeQuestion);
  if (r.under18Answers.includes(age)) return 'under18';
  if (r.over35Answers.includes(age)) return 'over35';
  if (r.lowTimeAnswers.includes(time) && !(r.lowTimeKeepsStreams || []).includes(win)) return 'lowTime';
  return 'apply';
}

/** Replace {name} placeholders in a text. */
export function fill(text, values) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m));
}
