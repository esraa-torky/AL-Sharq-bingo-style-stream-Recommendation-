// Saving finished surveys, and contact details visitors chose to leave, to the Google Sheet
// (see apps-script/Code.gs and README.md).
// Rows wait in this browser's storage until they are sent, so the iPad keeps working if the venue Wi-Fi drops.
// A row is removed from storage as soon as it has been sent, so contact details do not stay on the device.

const KEY = 'finder-queue';
const SEND_MS = 15000;  // give up on one attempt after this long (a weak connection can otherwise hang for minutes)
const RETRY_MS = 30000; // and try again this much later

function readQueue() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}
function writeQueue(q) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); return true; } catch (e) { return false; }
}

// Apps Script web apps do not answer CORS preflights, so send plain text without reading the reply.
// The reply cannot be read, so a row the script refuses is not retried: the form checks details with the
// same rules as the script (src/contact.js), so a real visitor's row is never refused.
async function send(url, row) {
  const stop = new AbortController(), timer = setTimeout(() => stop.abort(), SEND_MS);
  try {
    await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(row), signal: stop.signal });
  } finally {
    clearTimeout(timer);
  }
}
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
// rows queued before ids existed are matched by their content
const same = (a, b) => (a.id || b.id ? a.id === b.id : JSON.stringify(a) === JSON.stringify(b));

export function saveRow(url, row) {
  // automated browsers (our tests) never write to the real results sheet, unless a test asks to check saving
  if (!url || (typeof navigator !== 'undefined' && navigator.webdriver && !globalThis.__finderSaveInTests)) return;
  const item = { id: newId(), ...row }, q = readQueue();
  q.push(item);
  if (writeQueue(q.slice(-500))) flushQueue(url);
  else send(url, item).catch(() => { /* storage is blocked (some private windows): one direct try is all we can do */ });
}

let busy = false, retry = null;
export async function flushQueue(url) {
  if (!url || busy || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  busy = true;
  clearTimeout(retry);
  try {
    const sent = [];
    // stop if a sent row comes back: storage that cannot be written must not make us send the same row forever
    for (let next = readQueue()[0]; next && !sent.some((r) => same(r, next)); next = readQueue()[0]) {
      await send(url, next);
      sent.push(next);
      const q = readQueue(), i = q.findIndex((r) => same(r, next));
      if (i > -1) q.splice(i, 1);
      writeQueue(q);
    }
  } catch (e) {
    // offline, blocked or too slow: keep the queue and try again shortly
    retry = setTimeout(() => flushQueue(url), RETRY_MS);
  } finally {
    busy = false;
  }
}
