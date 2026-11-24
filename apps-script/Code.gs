// Program Finder results: receives one finished survey per request and adds a row to this spreadsheet.
// Setup steps are in README.md ("Saving results to a Google Sheet").
// Nothing personal is received: time, language, question style, answer ids, match, personality and scores.
//
// First time only: choose "setup" in the function list above and press Run. Google then asks you to allow
// the script to edit this spreadsheet. Without that permission every survey fails to save.

var SHEET_NAME = 'Results';
var COLUMNS = ['time', 'lang', 'style', 'stream', 'personality', 'strengths', 'nextStep', 'scores', 'answers'];

function resultsSheet() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
  return sheet;
}

// Run once from the editor: asks for permission and creates the Results tab with its headings.
function setup() {
  resultsSheet();
  Logger.log('Ready: the "' + SHEET_NAME + '" tab exists and the script may write to it.');
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var data = JSON.parse(e.postData.contents);
    resultsSheet().appendRow(COLUMNS.map(function (k) { return data[k] == null ? '' : String(data[k]).slice(0, 2000); }));
    return ContentService.createTextOutput('ok');
  } catch (err) {
    console.error('Could not save a result: ' + err);
    return ContentService.createTextOutput('error');
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function doGet() {
  return ContentService.createTextOutput('Program Finder results endpoint is running.');
}
