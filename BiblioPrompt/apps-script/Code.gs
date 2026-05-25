const SHEETS = {
  prompts: "Prompts",
  programs: "Programes",
  history: "Historial"
};

const PROPERTIES = {
  spreadsheetId: "BIBLIOPROMPT_SPREADSHEET_ID"
};

const CONFIG = {
  spreadsheetId: "1XQQSYPzBlKO7omo7A6iDl6DhEoUxQe4zepFijL4OBQI"
};

const PROMPT_HEADERS = [
  "id", "title", "content", "programIds", "categories", "tags", "notes",
  "favorite", "createdAt", "updatedAt", "version"
];

const PROGRAM_HEADERS = ["id", "name", "icon", "color"];
const HISTORY_HEADERS = [...PROMPT_HEADERS, "historyId", "promptId", "replacedAt"];

function doGet(e) {
  const action = (e.parameter.action || "getAll").trim();
  const callback = e.parameter.callback;
  let result;

  if (action === "getAll") {
    result = { ok: true, data: getAllData_() };
  } else {
    result = { ok: false, error: "Accio no reconeguda." };
  }

  const json = JSON.stringify(result);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    ensureSetup_();
    const request = JSON.parse(e.postData.contents || "{}");
    const payload = request.payload || {};
    let data;

    switch (request.action) {
      case "createPrompt":
        createPrompt_(payload);
        break;
      case "updatePrompt":
        updatePrompt_(payload);
        break;
      case "toggleFavorite":
        toggleFavorite_(payload.id);
        break;
      case "setFavorite":
        setFavorite_(payload.id, payload.favorite);
        break;
      case "deletePrompt":
        deletePrompt_(payload.id);
        break;
      default:
        throw new Error("Accio no reconeguda.");
    }

    data = getAllData_();
    return jsonOutput_({ ok: true, data });
  } catch (error) {
    return jsonOutput_({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function setupBiblioprompt() {
  const spreadsheet = getSpreadsheet_();
  PropertiesService.getScriptProperties().setProperty(PROPERTIES.spreadsheetId, spreadsheet.getId());

  ensureSheet_(SHEETS.prompts, PROMPT_HEADERS);
  ensureSheet_(SHEETS.programs, PROGRAM_HEADERS);
  ensureSheet_(SHEETS.history, HISTORY_HEADERS);
  ensureDefaultPrograms_();
  removeDeprecatedColumn_(SHEETS.prompts, "rating");
  removeDeprecatedColumn_(SHEETS.history, "rating");
}

function getAllData_() {
  ensureSetup_();
  return {
    prompts: readObjects_(SHEETS.prompts).map(parsePrompt_),
    programs: readObjects_(SHEETS.programs),
    history: readObjects_(SHEETS.history).map(parsePrompt_)
  };
}

function ensureSetup_() {
  ensureSheet_(SHEETS.prompts, PROMPT_HEADERS);
  ensureSheet_(SHEETS.programs, PROGRAM_HEADERS);
  ensureSheet_(SHEETS.history, HISTORY_HEADERS);
  ensureDefaultPrograms_();
  removeDeprecatedColumn_(SHEETS.prompts, "rating");
  removeDeprecatedColumn_(SHEETS.history, "rating");
  ensureProgramIdsColumn_(SHEETS.prompts);
  ensureProgramIdsColumn_(SHEETS.history);
}

function ensureDefaultPrograms_() {
  const programsSheet = getSpreadsheet_().getSheetByName(SHEETS.programs);
  if (programsSheet.getLastRow() === 1) {
    programsSheet.getRange(2, 1, 4, PROGRAM_HEADERS.length).setValues([
      ["chatgpt", "ChatGPT", "✦", "#10a37f"],
      ["gemini", "Gemini", "✧", "#2563eb"],
      ["notebooklm", "NotebookLM", "▣", "#7c3aed"],
      ["canva", "Canva", "◈", "#00a8b5"]
    ]);
  }
}

function createPrompt_(prompt) {
  const normalized = normalizePrompt_(prompt);
  const id = normalized.id || `prompt-${Utilities.getUuid()}`;
  if (findPrompt_(id)) return;
  const now = new Date().toISOString();
  const record = {
    ...normalized,
    id,
    createdAt: now,
    updatedAt: now,
    version: 1
  };
  appendObject_(SHEETS.prompts, PROMPT_HEADERS, record);
}

function updatePrompt_(newPrompt) {
  const prompt = findPrompt_(newPrompt.id);
  if (!prompt) throw new Error("No s'ha trobat el prompt.");
  const normalized = normalizePrompt_(newPrompt);
  if (samePromptContent_(prompt.value, normalized)) return;

  const now = new Date().toISOString();
  addHistory_(prompt.value, now);
  const updated = {
    ...normalized,
    createdAt: prompt.value.createdAt,
    updatedAt: now,
    version: Number(prompt.value.version) + 1
  };
  writeObjectRow_(SHEETS.prompts, PROMPT_HEADERS, prompt.row, updated);
}

function toggleFavorite_(id) {
  const prompt = findPrompt_(id);
  if (!prompt) throw new Error("No s'ha trobat el prompt.");

  const now = new Date().toISOString();
  addHistory_(prompt.value, now);
  const updated = {
    ...prompt.value,
    favorite: !toBoolean_(prompt.value.favorite),
    updatedAt: now,
    version: Number(prompt.value.version) + 1
  };
  writeObjectRow_(SHEETS.prompts, PROMPT_HEADERS, prompt.row, updated);
}

function setFavorite_(id, favorite) {
  const prompt = findPrompt_(id);
  if (!prompt) throw new Error("No s'ha trobat el prompt.");
  const value = toBoolean_(favorite);
  if (prompt.value.favorite === value) return;
  const now = new Date().toISOString();
  addHistory_(prompt.value, now);
  writeObjectRow_(SHEETS.prompts, PROMPT_HEADERS, prompt.row, {
    ...prompt.value,
    favorite: value,
    updatedAt: now,
    version: Number(prompt.value.version) + 1
  });
}

function deletePrompt_(id) {
  const prompt = findPrompt_(id);
  if (!prompt) return;
  addHistory_(prompt.value, new Date().toISOString());
  getSpreadsheet_().getSheetByName(SHEETS.prompts).deleteRow(prompt.row);
}

function addHistory_(prompt, date) {
  appendObject_(SHEETS.history, HISTORY_HEADERS, {
    ...prompt,
    historyId: `history-${Utilities.getUuid()}`,
    promptId: prompt.id,
    replacedAt: date
  });
}

function findPrompt_(id) {
  const records = readObjects_(SHEETS.prompts);
  const index = records.findIndex((record) => record.id === id);
  return index < 0 ? null : { row: index + 2, value: parsePrompt_(records[index]) };
}

function parsePrompt_(prompt) {
  return {
    ...prompt,
    programIds: parseProgramIds_(prompt.programIds || prompt.programId),
    categories: parseArray_(prompt.categories),
    tags: parseArray_(prompt.tags),
    favorite: toBoolean_(prompt.favorite),
    version: Number(prompt.version || 1)
  };
}

function normalizePrompt_(prompt) {
  return {
    ...prompt,
    programIds: parseProgramIds_(prompt.programIds || prompt.programId)
  };
}

function samePromptContent_(left, right) {
  return ["title", "content", "notes", "favorite"].every((key) => String(left[key]) === String(right[key]))
    && JSON.stringify(left.programIds || []) === JSON.stringify(right.programIds || [])
    && JSON.stringify(left.categories || []) === JSON.stringify(right.categories || [])
    && JSON.stringify(left.tags || []) === JSON.stringify(right.tags || []);
}

function parseProgramIds_(value) {
  const aliases = {
    "chatgpt": "chatgpt",
    "gemini": "gemini",
    "notebooklm": "notebooklm",
    "canva": "canva"
  };
  return parseArray_(value)
    .map((item) => aliases[String(item).trim().toLowerCase()] || String(item).trim())
    .filter(Boolean);
}

function parseArray_(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch (error) {
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function toBoolean_(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function ensureSheet_(name, headers) {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function ensureProgramIdsColumn_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const legacyIndex = headers.indexOf("programId");
  if (legacyIndex < 0) return;
  const column = legacyIndex + 1;
  sheet.getRange(1, column).setValue("programIds");
  if (sheet.getLastRow() > 1) {
    const range = sheet.getRange(2, column, sheet.getLastRow() - 1, 1);
    const values = range.getValues().map(([value]) => [JSON.stringify(parseProgramIds_(value))]);
    range.setValues(values);
  }
}

function removeDeprecatedColumn_(name, columnName) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headers.indexOf(columnName);
  if (index >= 0) {
    sheet.deleteColumn(index + 1);
  }
}

function readObjects_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

function appendObject_(name, headers, object) {
  const row = headers.map((header) => serializeCell_(object[header]));
  getSpreadsheet_().getSheetByName(name).appendRow(row);
}

function writeObjectRow_(name, headers, row, object) {
  const values = headers.map((header) => serializeCell_(object[header]));
  getSpreadsheet_().getSheetByName(name).getRange(row, 1, 1, headers.length).setValues([values]);
}

function serializeCell_(value) {
  return Array.isArray(value) ? JSON.stringify(value) : value ?? "";
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(PROPERTIES.spreadsheetId)
    || CONFIG.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Cal configurar l'identificador del Google Sheets.");
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function jsonOutput_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
