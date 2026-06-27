const ACCESS_KEY = 'SoL';

const SHEETS = {
  classes: 'Classes',
  students: 'Alumnes',
  typologies: 'Tipologies',
  conditions: 'Condicions',
  teams: 'Equips',
  config: 'Configuració'
};

function setSynAppSpreadsheetId(spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error('Cal indicar l’ID del Google Sheets.');
  }
  PropertiesService.getScriptProperties().setProperty('SYNAPP_SPREADSHEET_ID', spreadsheetId);
  return { ok: true };
}

function doGet(event) {
  return handleRequest_(event, true);
}

function doPost(event) {
  return handleRequest_(event, false);
}

function handleRequest_(event, allowJsonp) {
  const body = parseBody_(event);
  if (body.key !== ACCESS_KEY) {
    return output_({ ok: false, error: 'Clau no vàlida' }, body.callback, allowJsonp);
  }

  const action = body.action || '';
  if (action === 'bootstrap') return output_(getBootstrapData_(), body.callback, allowJsonp);
  if (action === 'saveTeams') return output_(saveTeams_(body.payload || {}), body.callback, allowJsonp);
  if (action === 'saveStudentType') return output_(saveStudentType_(body.payload || {}), body.callback, allowJsonp);
  if (action === 'saveStudentActive') return output_(saveStudentActive_(body.payload || {}), body.callback, allowJsonp);

  return output_({ ok: false, error: 'Acció desconeguda' }, body.callback, allowJsonp);
}

function setupSpreadsheet() {
  const spreadsheet = getSpreadsheet_();
  ensureSheet_(spreadsheet, SHEETS.classes, ['id_classe', 'nom_classe', 'etapa', 'curs', 'grup', 'activa']);
  ensureSheet_(spreadsheet, SHEETS.students, ['id_alumne', 'nom', 'cognoms', 'id_classe', 'actiu', 'observacions']);
  ensureSheet_(spreadsheet, SHEETS.typologies, ['id_alumne', 'id_classe', 'tipologia', 'data_actualitzacio']);
  ensureSheet_(spreadsheet, SHEETS.conditions, ['id_condicio', 'id_classe', 'tipus', 'forca', 'alumnes', 'notes']);
  ensureSheet_(spreadsheet, SHEETS.teams, ['id_generacio', 'data', 'id_classe', 'mida', 'tipus_generacio', 'compliment_global', 'equips_json']);
  ensureSheet_(spreadsheet, SHEETS.config, ['clau', 'valor']);
  ensureClassSheets_(spreadsheet);
}

function getBootstrapData_() {
  const spreadsheet = getSpreadsheet_();
  const classes = rows_(spreadsheet.getSheetByName(SHEETS.classes))
    .filter(row => String(row.activa || '').toLowerCase() !== 'no')
    .map(row => ({
      id: String(row.id_classe || '').trim(),
      name: String(row.nom_classe || '').trim(),
      tabName: String(row.pestanya || row.nom_classe || '').trim()
    }))
    .filter(row => row.id && row.name);

  let students = readStudentsFromClassSheets_(spreadsheet, classes);
  if (students.length === 0) {
    students = rows_(spreadsheet.getSheetByName(SHEETS.students))
      .filter(row => String(row.actiu || '').toLowerCase() !== 'no')
      .map(row => ({
        id: row.id_alumne,
        classId: row.id_classe,
        name: [row.nom, row.cognoms].filter(Boolean).join(' ').trim(),
        type: 'B',
        active: true
      }));
  }

  const typologies = rows_(spreadsheet.getSheetByName(SHEETS.typologies));
  const typeMap = new Map(typologies.map(row => [`${row.id_classe}:${row.id_alumne}`, row.tipologia]));
  students.forEach(student => {
    student.type = normaliseType_(typeMap.get(`${student.classId}:${student.id}`) || student.type);
  });

  const conditions = rows_(spreadsheet.getSheetByName(SHEETS.conditions))
    .map(row => ({
      id: row.id_condicio,
      classId: row.id_classe,
      type: row.tipus === 'agrupament_forcat' ? 'forced' : 'incompatibility',
      strength: row.forca === 'preferent' ? 'preferred' : 'required',
      studentIds: String(row.alumnes || '').split(',').map(value => value.trim()).filter(Boolean)
    }));

  return { ok: true, classes, students, conditions, lastTeams: [] };
}

function ensureClassSheets_(spreadsheet) {
  const classes = rows_(spreadsheet.getSheetByName(SHEETS.classes))
    .filter(row => String(row.activa || '').toLowerCase() !== 'no');
  classes.forEach(row => {
    const tabName = String(row.pestanya || row.nom_classe || '').trim();
    if (!tabName) return;
    ensureSheet_(spreadsheet, tabName, ['Nom', 'Cognoms', 'Tipologia', 'Actiu', 'Observacions']);
  });
}

function readStudentsFromClassSheets_(spreadsheet, classes) {
  const students = [];
  classes.forEach(classItem => {
    const sheet = spreadsheet.getSheetByName(classItem.tabName || classItem.name);
    if (!sheet) return;
    rows_(sheet).forEach((row, index) => {
      const firstName = String(row.Nom || row.nom || '').trim();
      const lastName = String(row.Cognoms || row.cognoms || '').trim();
      const active = String(row.Actiu || row.actiu || 'sí').toLowerCase();
      if (!firstName && !lastName) return;
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
      students.push({
        id: `${classItem.id}:${slug_(`${firstName}-${lastName}`) || `fila-${index + 2}`}`,
        classId: classItem.id,
        firstName,
        lastName,
        name: fullName,
        type: normaliseType_(row.Tipologia || row.tipologia || 'B'),
        active: active !== 'no'
      });
    });
  });
  return students;
}

function saveTeams_(payload) {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(SHEETS.teams);
  sheet.appendRow([
    Utilities.getUuid(),
    new Date(),
    payload.classId || '',
    payload.size || '',
    payload.mode || '',
    payload.score || '',
    JSON.stringify(payload.teams || [])
  ]);
  return { ok: true };
}

function saveStudentType_(payload) {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(SHEETS.typologies);
  sheet.appendRow([
    payload.studentId || '',
    payload.classId || '',
    normaliseType_(payload.type),
    new Date()
  ]);
  return { ok: true };
}

function saveStudentActive_(payload) {
  const spreadsheet = getSpreadsheet_();
  const classes = rows_(spreadsheet.getSheetByName(SHEETS.classes));
  const classRow = classes.find(row => String(row.id_classe || '').trim() === String(payload.classId || '').trim());
  const tabName = classRow ? String(classRow.pestanya || classRow.nom_classe || '').trim() : '';
  const sheet = tabName ? spreadsheet.getSheetByName(tabName) : null;
  if (!sheet) return { ok: false, error: 'Classe no trobada' };

  const targetId = String(payload.studentId || '');
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    const firstName = String(values[i][0] || '').trim();
    const lastName = String(values[i][1] || '').trim();
    const rowId = `${payload.classId}:${slug_(`${firstName}-${lastName}`) || `fila-${i + 1}`}`;
    if (rowId === targetId) {
      sheet.getRange(i + 1, 4).setValue(payload.active ? 'sí' : 'no');
      return { ok: true };
    }
  }
  return { ok: false, error: 'Alumne no trobat' };
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SYNAPP_SPREADSHEET_ID');
  if (!id) {
    throw new Error('Falta configurar SYNAPP_SPREADSHEET_ID a les propietats del projecte.');
  }
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
}

function rows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(header => String(header).trim());
  return values.map(row => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });
    return item;
  });
}

function normaliseType_(value) {
  const type = String(value || 'B').toUpperCase();
  return ['A', 'B', 'C'].includes(type) ? type : 'B';
}

function slug_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseBody_(event) {
  if (event && event.parameter) {
    let payload = {};
    try {
      payload = event.parameter.payload ? JSON.parse(event.parameter.payload) : {};
    } catch (error) {
      payload = {};
    }
    return {
      key: event.parameter.key || '',
      action: event.parameter.action || '',
      callback: event.parameter.callback || '',
      payload
    };
  }
  try {
    return JSON.parse(event.postData.contents || '{}');
  } catch (error) {
    return {};
  }
}

function output_(payload, callback, allowJsonp) {
  if (allowJsonp && callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Callback no vàlid' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(payload)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
