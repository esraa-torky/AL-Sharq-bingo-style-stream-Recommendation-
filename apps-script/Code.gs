// Al Sharq Youth site: receives one request per finished test or submitted form and adds a row to this spreadsheet.
// Setup steps are in README.md ("Saving results to a Google Sheet").
//
// - Program Finder test results go to the "Results" tab: time, language, question style, answers, match,
//   personality and scores. Nothing personal.
// - The three landing-page forms go to their own tabs: "Join a hub", "Open a hub" and "Join a program".
//   These hold the names and contact details people type in, so share the spreadsheet only with the team.
//   Each tab gets its headings from the first form sent to it; a new field later adds a new column at the end.
//
// First time only: choose "setup" in the function list above and press Run. Google then asks you to allow
// the script to edit this spreadsheet. Without that permission nothing is saved.
// After pasting a new version of this file: Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy.
// The web app address stays the same.

var SHEET_NAME = 'Results';
var COLUMNS = ['time', 'lang', 'style', 'stream', 'personality', 'strengths', 'nextStep', 'scores', 'answers'];
var FORM_SHEETS = { 'join-hub': 'Join a hub', 'open-hub': 'Open a hub', 'join-program': 'Join a program' };
var FORM_FIRST = ['time', 'lang'];               // these come first in every form tab
var FORM_SKIP = ['form', 'sheet', 'website'];   // routing keys and the spam trap are not stored

function resultsSheet() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
  return sheet;
}

function formSheet(formId) {
  var name = FORM_SHEETS[formId];
  if (!name) return null; // only the three known tabs can be written to
  var book = SpreadsheetApp.getActiveSpreadsheet();
  return book.getSheetByName(name) || book.insertSheet(name);
}

// Run once from the editor: asks for permission and creates the tabs.
function setup() {
  resultsSheet();
  Object.keys(FORM_SHEETS).forEach(formSheet);
  Logger.log('Ready: the Results, Join a hub, Open a hub and Join a program tabs exist and the script may write to them.');
}

function cell(v) {
  var s = v == null ? '' : String(v).slice(0, 2000);
  return /^[=+\-@]/.test(s) ? "'" + s : s; // typed text is never run as a spreadsheet formula
}

function saveForm(data) {
  var sheet = formSheet(data.form);
  if (!sheet) throw new Error('unknown form ' + data.form);
  if (data.website) return; // the hidden spam-trap field was filled in: a bot, not a person
  var keys = Object.keys(data).filter(function (k) { return FORM_SKIP.indexOf(k) === -1; });
  var headers = sheet.getLastRow() === 0 ? [] : sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.length === 0) {
    headers = FORM_FIRST.concat(keys.filter(function (k) { return FORM_FIRST.indexOf(k) === -1; }));
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    var added = keys.filter(function (k) { return headers.indexOf(k) === -1; });
    if (added.length) {
      sheet.getRange(1, headers.length + 1, 1, added.length).setValues([added]);
      headers = headers.concat(added);
    }
  }
  sheet.appendRow(headers.map(function (k) { return cell(data[k]); }));
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var data = JSON.parse(e.postData.contents);
    if (data.form) saveForm(data);
    else resultsSheet().appendRow(COLUMNS.map(function (k) { return cell(data[k]); }));
    return ContentService.createTextOutput('ok');
  } catch (err) {
    console.error('Could not save: ' + err);
    return ContentService.createTextOutput('error');
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function doGet() {
  return ContentService.createTextOutput('Al Sharq Youth results endpoint is running.');
}
