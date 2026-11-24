// Program Finder results: receives one finished survey (or one visitor's contact details) per request
// and adds a row to this spreadsheet. Setup steps are in README.md ("Saving results to a Google Sheet").
//
//   Results tab:  time, language, question style, match, personality, strengths, next step, scores, answer ids.
//                 Nothing personal.
//   Contacts tab: name, email and phone of visitors who chose to leave them and ticked the consent box,
//                 with the time, language, matched stream and the consent text they agreed to.
//                 Keep this spreadsheet shared with as few people as possible (see README.md).
//
// The web app is open to anyone, so every request is checked here, whatever the site sent:
// unexpected requests are refused, and every value is stored as plain text so it can never run as a formula.
// The contact rules match src/contact.js; tests/check-apps-script.mjs makes sure they stay the same.
//
// First time only: choose "setup" in the function list above and press Run. Google then asks you to allow
// the script to edit this spreadsheet. Without that permission every survey fails to save.

var TABS = {
  result: { name: 'Results', columns: ['time', 'lang', 'style', 'stream', 'personality', 'strengths', 'nextStep', 'scores', 'answers'] },
  contact: { name: 'Contacts', columns: ['time', 'lang', 'stream', 'name', 'email', 'phone', 'consent'] },
};
var MAX_REQUEST = 10000; // characters; a real request is well under 2000

function sheetFor(kind) {
  var tab = TABS[kind], book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(tab.name) || book.insertSheet(tab.name);
  if (sheet.getLastRow() === 0) { sheet.appendRow(tab.columns); sheet.setFrozenRows(1); }
  return sheet;
}

// Run once from the editor: asks for permission and creates both tabs with their headings.
function setup() {
  sheetFor('result');
  sheetFor('contact');
  Logger.log('Ready: the "Results" and "Contacts" tabs exist and the script may write to them.');
}

/* ---------- the same rules as src/contact.js ---------- */
var LIMITS = { name: 100, email: 254, phone: 30 };
var EMAIL = /^[^\s@<>"=+\-][^\s@<>"]*@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
var PHONE = /^\+?[0-9 ().-]+$/;

function asciiDigits(s) {
  return s.replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
    .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
}

function tidy(v, max) {
  return String(v == null ? '' : v).normalize('NFC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B\u202A-\u202E\u2066-\u2069\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

function checkContact(raw) {
  var r = raw || {};
  var name = tidy(r.name, LIMITS.name).replace(/^[=+\-@\s]+/, '');
  var email = tidy(r.email, LIMITS.email).replace(/ /g, '').toLowerCase();
  var phone = tidy(asciiDigits(String(r.phone == null ? '' : r.phone)), LIMITS.phone);
  var digits = phone.replace(/[^0-9]/g, '').length;
  var errors = [];
  if (!name) errors.push('name');
  if (!EMAIL.test(email)) errors.push('email');
  if (phone && !(PHONE.test(phone) && digits >= 7 && digits <= 15)) errors.push('phone');
  if (r.consent !== true) errors.push('consent');
  return { ok: !errors.length, errors: errors, value: { name: name, email: email, phone: phone } };
}
/* ---------- end of the shared rules ---------- */

// Plain text for the sheet. Leading = + - @ are dropped (so the value is also safe if the sheet is exported
// to CSV and opened in Excel), and the leading apostrophe tells Sheets to keep the rest as text:
// no formulas, and phone numbers keep their leading 0 and +.
function text(v, max) {
  var s = tidy(v, max || 2000).replace(/^[=+\-@\s]+/, '');
  return s ? "'" + s : '';
}

var TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
var LANG = /^[a-z]{2,3}$/;
var STREAM = /^[A-Z]{1,3}$/;

// Returns { kind, values } for a request worth saving, or a short reason (never the visitor's details) if not.
function rowFor(data) {
  if (!data || typeof data !== 'object') return 'not an object';
  if (!LANG.test(data.lang) || !STREAM.test(data.stream)) return 'bad language or stream';
  if (data.type === 'contact') {
    var c = checkContact(data);
    if (!c.ok) return 'contact details failed: ' + c.errors.join(', ');
    return {
      kind: 'contact',
      // the server's own clock: contact rows are sent straight away, and the time is not taken on trust
      values: [new Date(), data.lang, data.stream, text(c.value.name), text(c.value.email), c.value.phone ? "'" + c.value.phone : '',
        text('yes: ' + tidy(data.consentText, 600), 620)],
    };
  }
  if (data.type != null && data.type !== 'result') return 'unknown type';
  if (!TIME.test(data.time) || ['scale', 'choices'].indexOf(data.style) < 0) return 'bad time or style';
  return {
    kind: 'result',
    values: [data.time, data.lang, data.style, data.stream, text(data.personality, 40), text(data.strengths, 200),
      text(data.nextStep, 40), text(data.scores, 400), text(data.answers, 2000)],
  };
}

function doPost(e) {
  var body = e && e.postData && e.postData.contents;
  if (!body || body.length > MAX_REQUEST) return reply('error', 'empty or too large');
  var data;
  try { data = JSON.parse(body); } catch (err) { return reply('error', 'not JSON'); }
  var row = rowFor(data);
  if (typeof row === 'string') return reply('error', row);
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    sheetFor(row.kind).appendRow(row.values);
    return reply('ok');
  } catch (err) {
    return reply('error', 'could not write: ' + err);
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// Refusals are logged (see Executions in the Apps Script editor) without the visitor's details.
function reply(status, why) {
  if (why) console.error('Not saved: ' + why);
  return ContentService.createTextOutput(status);
}

function doGet() {
  return ContentService.createTextOutput('Program Finder results endpoint is running.');
}
