// Saving finished surveys to the Google Sheet (see apps-script/Code.gs and README.md).
// Nothing personal is sent: only the time, language, answer ids, match and personality.
// Results wait in this browser's storage and are sent when there is a connection,
// so the iPad keeps working if the venue Wi-Fi drops.

const KEY = 'finder-queue';

function readQueue() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}
function writeQueue(q) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch (e) { /* storage unavailable: nothing to keep */ }
}

export function saveResult(url, row) {
  // automated browsers (our tests) never write to the real results sheet
  if (!url || (typeof navigator !== 'undefined' && navigator.webdriver)) return;
  const q = readQueue();
  q.push(row);
  writeQueue(q.slice(-500));
  flushQueue(url);
}

let busy = false;
export async function flushQueue(url) {
  if (!url || busy || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  busy = true;
  try {
    let q = readQueue();
    while (q.length) {
      // Apps Script web apps do not answer CORS preflights, so send plain text without reading the reply.
      await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(q[0]) });
      q = readQueue().slice(1);
      writeQueue(q);
    }
  } catch (e) {
    // offline or blocked: keep the queue and try again later
  } finally {
    busy = false;
  }
}
