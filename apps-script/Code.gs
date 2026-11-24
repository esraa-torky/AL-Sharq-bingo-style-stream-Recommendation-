/**
 * Program Finder results: receives one finished survey per request and adds a row to this spreadsheet.
 * Setup steps are in README.md ("Saving results to a Google Sheet").
 * Nothing personal is received: time, language, question style, answer ids, match, personality and scores.
 */
var SHEET_NAME = 'Results';
var COLUMNS = ['time', 'lang', 'style', 'stream', 'personality', 'strengths', 'nextStep', 'scores', 'answers'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) ||
      SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
    sheet.appendRow(COLUMNS.map(function (k) { return data[k] == null ? '' : String(data[k]).slice(0, 2000); }));
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error');
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('Program Finder results endpoint is running.');
}
