const ROW_MEMORY_CACHE = {};

function ensureDatabase(options) {
  options = options || {};
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty(APP.spreadsheetIdProperty);
  let spreadsheet;

  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create(APP.databaseName);
    properties.setProperty(APP.spreadsheetIdProperty, spreadsheet.getId());
  }

  const cache = CacheService.getScriptCache();
  const setupKey = `db_setup_${APP.seedVersion}`;
  if (options.forceSetup || !cache.get(setupKey)) {
    setupSheets(spreadsheet);
    seedInitialDataIfNeeded(spreadsheet);
    cache.put(setupKey, '1', 21600);
  }

  if (options.syncRosters) {
    syncEditableRostersIfNeeded(spreadsheet, Boolean(options.forceSync));
  }
  return spreadsheet;
}

function getDatabase() {
  return ensureDatabase();
}

function syncEditableRostersIfNeeded(spreadsheet, forceSync) {
  const cache = CacheService.getScriptCache();
  const syncKey = `roster_sync_${APP.seedVersion}`;
  if (!forceSync && cache.get(syncKey)) return;
  syncEditableRostersToInternal(spreadsheet);
  syncRostersToSupabaseIfConfigured(spreadsheet, forceSync);
  tidyVisibleSheets(spreadsheet);
  cache.put(syncKey, '1', 600);
}

function setupSheets(spreadsheet) {
  ensureEditableRosterSheets(spreadsheet);
  Object.values(SHEETS).forEach((sheetName) => {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
    ensureHeaders(sheet, HEADERS[sheetName]);
  });
  const first = spreadsheet.getSheets()[0];
  if (first.getName() === 'Full 1' || first.getName() === 'Sheet1') {
    spreadsheet.deleteSheet(first);
  }
  tidyVisibleSheets(spreadsheet);
}

function ensureEditableRosterSheets(spreadsheet) {
  ROSTER_SHEETS.forEach((roster) => {
    const sheet = ensureSheet(spreadsheet, roster.sheetName);
    ensureHeaders(sheet, ROSTER_HEADERS);
  });
  const teachersSheet = ensureSheet(spreadsheet, ROSTER_TEACHERS_SHEET);
  migrateLegacyTeacherSheetToRoster(spreadsheet, teachersSheet);
  ensureHeaders(teachersSheet, ROSTER_HEADERS);
}

function tidyVisibleSheets(spreadsheet) {
  const visibleNames = new Set(
    ROSTER_SHEETS.map((roster) => roster.sheetName).concat([ROSTER_TEACHERS_SHEET])
  );
  const sheets = spreadsheet.getSheets();
  let visibleCount = sheets.filter((sheet) => !sheet.isSheetHidden()).length;
  sheets.forEach((sheet) => {
    if (visibleNames.has(sheet.getName())) {
      sheet.showSheet();
      return;
    }
    if (visibleCount > 1 && !sheet.isSheetHidden()) {
      sheet.hideSheet();
      visibleCount -= 1;
    }
  });
}

function migrateLegacyTeacherSheetToRoster(spreadsheet, sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values.length || values[0][0] !== 'professor_id') return;
  const headers = values[0];
  const nomIndex = headers.indexOf('nom');
  const cognomsIndex = headers.indexOf('cognoms');
  const emailIndex = headers.indexOf('email');
  const rows = values.slice(1)
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => ({
      'Nom': nomIndex >= 0 ? row[nomIndex] : '',
      'Cognom': cognomsIndex >= 0 ? row[cognomsIndex] : '',
      'Correu electrònic': emailIndex >= 0 ? row[emailIndex] : ''
    }));
  sheet.clear();
  ensureHeaders(sheet, ROSTER_HEADERS);
  replaceRosterRows(spreadsheet, ROSTER_TEACHERS_SHEET, rows);
}

function ensureSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  return sheet;
}

function ensureHeaders(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  const current = range.getValues()[0];
  const needsHeader = current.every((cell) => cell === '') || headers.some((header, index) => current[index] !== header);
  if (needsHeader) {
    range.setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#eef3ff');
  }
}

function readRows(sheetName) {
  const cached = ROW_MEMORY_CACHE[sheetName];
  if (cached && Date.now() - cached.time < 10000) return cached.rows;
  const sheet = getDatabase().getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  const rows = values.slice(1)
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => objectFromRow(headers, row));
  ROW_MEMORY_CACHE[sheetName] = { time: Date.now(), rows };
  return rows;
}

function appendRow(sheetName, data) {
  const sheet = getDatabase().getSheetByName(sheetName);
  const headers = HEADERS[sheetName];
  sheet.appendRow(headers.map((header) => data[header] ?? ''));
  clearRowCache(sheetName);
}

function appendRows(sheetName, rows) {
  if (!rows.length) return;
  const sheet = getDatabase().getSheetByName(sheetName);
  const headers = HEADERS[sheetName];
  const values = rows.map((row) => headers.map((header) => row[header] ?? ''));
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  clearRowCache(sheetName);
}

function updateRowById(sheetName, idField, idValue, updates) {
  const sheet = getDatabase().getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf(idField);
  if (idIndex < 0) throw new Error(`No existeix la columna ${idField}.`);
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (values[rowIndex][idIndex] === idValue) {
      Object.keys(updates).forEach((key) => {
        const colIndex = headers.indexOf(key);
        if (colIndex >= 0) sheet.getRange(rowIndex + 1, colIndex + 1).setValue(updates[key]);
      });
      clearRowCache(sheetName);
      return;
    }
  }
  throw new Error('No s’ha trobat el registre.');
}

function objectFromRow(headers, row) {
  return headers.reduce((obj, header, index) => {
    obj[header] = normalizeCell(row[index]);
    return obj;
  }, {});
}

function clearRowCache(sheetName) {
  if (sheetName) {
    delete ROW_MEMORY_CACHE[sheetName];
  } else {
    Object.keys(ROW_MEMORY_CACHE).forEach((key) => delete ROW_MEMORY_CACHE[key]);
  }
}

function readSheetRows(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1)
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => objectFromRow(headers, row));
}

function replaceSheetRows(spreadsheet, sheetName, rows) {
  const sheet = ensureSheet(spreadsheet, sheetName);
  const headers = HEADERS[sheetName];
  ensureHeaders(sheet, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), headers.length)).clearContent();
  }
  clearRowCache(sheetName);
  if (!rows.length) return;
  const values = rows.map((row) => headers.map((header) => row[header] ?? ''));
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function replaceRosterRows(spreadsheet, sheetName, rows) {
  const sheet = ensureSheet(spreadsheet, sheetName);
  ensureHeaders(sheet, ROSTER_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), ROSTER_HEADERS.length)).clearContent();
  }
  if (!rows.length) return;
  const values = rows.map((row) => ROSTER_HEADERS.map((header) => row[header] ?? ''));
  sheet.getRange(2, 1, values.length, ROSTER_HEADERS.length).setValues(values);
}

function normalizeCell(value) {
  if (value instanceof Date) return Utilities.formatDate(value, APP.timeZone || 'Europe/Madrid', 'yyyy-MM-dd');
  if (value === null || typeof value === 'undefined') return '';
  return value;
}

function findBy(sheetName, field, value) {
  return readRows(sheetName).find((row) => String(row[field]).toLowerCase() === String(value).toLowerCase()) || null;
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}${Utilities.getUuid().slice(0, 8).toUpperCase()}`;
}

function withScriptLock(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}
