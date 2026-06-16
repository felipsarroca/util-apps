function getDatabase_() {
  const id = PropertiesService.getScriptProperties().getProperty(
    APP_CONFIG.spreadsheetProperty
  );
  if (!id) {
    throw new Error("La base de dades encara no s'ha inicialitzat.");
  }
  return SpreadsheetApp.openById(id);
}

function initializeApplication() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Executa la inicialització des del Google Sheets vinculat.");
  }
  const existingYears = spreadsheet.getSheetByName("CursosEscolars");
  if (existingYears && existingYears.getLastRow() > 1) {
    SpreadsheetApp.getUi().alert(
      "Massa horària",
      "La base de dades ja està inicialitzada. No s'ha modificat cap dada.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  const ownerEmail = effectiveUserEmail_();
  if (!ownerEmail) {
    throw new Error("No s'ha pogut identificar el compte propietari.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    PropertiesService.getScriptProperties().setProperty(
      APP_CONFIG.spreadsheetProperty,
      spreadsheet.getId()
    );
    Object.keys(TABLES).forEach((name) => ensureTable_(spreadsheet, name, TABLES[name]));
    seedDatabase_(spreadsheet, ownerEmail);
    formatDatabase_(spreadsheet);
    protectDatabase_(spreadsheet);
    SpreadsheetApp.getUi().alert(
      "Massa horària",
      "La base de dades s'ha inicialitzat correctament.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } finally {
    lock.releaseLock();
  }
}

function ensureTable_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function replaceTable_(spreadsheet, name, rows) {
  const headers = TABLES[name];
  const sheet = ensureTable_(spreadsheet, name, headers);
  const maxRows = Math.max(sheet.getMaxRows() - 1, 0);
  if (maxRows > 0) {
    sheet.getRange(2, 1, maxRows, headers.length).clearContent();
  }
  if (!rows.length) return;
  const values = rows.map((row) => headers.map((header) => row[header] ?? ""));
  if (sheet.getMaxRows() < values.length + 1) {
    sheet.insertRowsAfter(sheet.getMaxRows(), values.length + 1 - sheet.getMaxRows());
  }
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function seedDatabase_(spreadsheet, ownerEmail) {
  const year = SEED_DATA.academicYear;
  const now = new Date();
  replaceTable_(spreadsheet, "Configuracio", [
    { Clau: "APP_NAME", Valor: APP_CONFIG.name },
    { Clau: "APP_SUBTITLE", Valor: APP_CONFIG.subtitle },
    { Clau: "APP_VERSION", Valor: APP_CONFIG.version },
    { Clau: "ACTIVE_ACADEMIC_YEAR_ID", Valor: year.id },
  ]);
  replaceTable_(spreadsheet, "CursosEscolars", [
    { Id: year.id, Nom: year.nom, Estat: year.estat, Actiu: year.actiu, CreatEl: now },
  ]);
  replaceTable_(
    spreadsheet,
    "Professorat",
    SEED_DATA.teachers.map((item) => ({
      Id: item.id,
      Cognom1: safeText_(item.cognom1, 80),
      Cognom2: safeText_(item.cognom2, 80),
      Nom: safeText_(item.nom, 80),
      NomComplet: safeText_(item.nomComplet, 180),
      Actiu: item.actiu,
    }))
  );
  replaceTable_(
    spreadsheet,
    "Contractes",
    SEED_DATA.contracts.map((item) => ({
      Id: item.id,
      CursEscolarId: year.id,
      ProfessorId: item.professorId,
      Hores: item.hores,
      Actiu: item.actiu,
    }))
  );
  replaceTable_(
    spreadsheet,
    "Grups",
    SEED_DATA.courses.map((item) => ({
      Id: item.id,
      CursEscolarId: year.id,
      Codi: item.codi,
      Nom: item.nom,
      Etapa: item.etapa,
      Ordre: item.ordre,
      HoresObjectiu: item.horesObjectiu,
      Actiu: item.actiu,
    }))
  );
  replaceTable_(
    spreadsheet,
    "Materies",
    SEED_DATA.subjects.map((item) => ({
      Id: item.id,
      Nom: item.nom,
      NomCurt: item.nomCurt,
      Activa: item.activa,
    }))
  );
  replaceTable_(
    spreadsheet,
    "PlaEstudis",
    SEED_DATA.plans.map((item) => ({
      Id: item.id,
      CursEscolarId: year.id,
      GrupId: item.grupId,
      MateriaId: item.materiaId,
      Ordre: item.ordre,
      HoresObjectiu: item.horesObjectiu,
      TipusBase: item.tipusBase,
      Actiu: item.actiu,
    }))
  );
  replaceTable_(
    spreadsheet,
    "Assignacions",
    SEED_DATA.assignments.map((item) => ({
      Id: item.id,
      CursEscolarId: year.id,
      GrupId: item.grupId,
      MateriaId: item.materiaId,
      ProfessorId: item.professorId,
      Tipus: item.tipus,
      Hores: item.hores,
      FactorCobertura: item.factorCobertura,
      Observacions: item.observacions,
      Activa: item.activa,
      ActualitzatEl: now,
      ActualitzatPer: ownerEmail,
    }))
  );
  replaceTable_(
    spreadsheet,
    "Carrecs",
    SEED_DATA.charges.map((item) => ({
      Id: item.id,
      Nom: item.nom,
      Ordre: item.ordre,
      Actiu: item.actiu,
    }))
  );
  replaceTable_(
    spreadsheet,
    "AssignacionsCarrecs",
    SEED_DATA.chargeAssignments.map((item) => ({
      Id: item.id,
      CursEscolarId: year.id,
      ProfessorId: item.professorId,
      CarrecId: item.carrecId,
      Hores: item.hores,
      Observacions: item.observacions,
      Activa: item.activa,
      ActualitzatEl: now,
      ActualitzatPer: ownerEmail,
    }))
  );
  replaceTable_(
    spreadsheet,
    "ReglesComput",
    SEED_DATA.rules.map((item) => ({
      Id: item.id,
      CursEscolarId: year.id,
      Etapa: item.etapa,
      PercentatgeHdc: item.percentatgeHdc,
      Actiu: item.actiu,
    }))
  );
  replaceTable_(spreadsheet, "Usuaris", [
    { Email: ownerEmail, Nom: "Administrador", Rol: "ADMIN", Actiu: true },
  ]);
  replaceTable_(spreadsheet, "RegistreCanvis", []);
}

function formatDatabase_(spreadsheet) {
  const headerColor = "#17324d";
  Object.keys(TABLES).forEach((name) => {
    const sheet = spreadsheet.getSheetByName(name);
    const columns = TABLES[name].length;
    sheet
      .getRange(1, 1, 1, columns)
      .setBackground(headerColor)
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    sheet.autoResizeColumns(1, columns);
    sheet.setHiddenGridlines(true);
    if (name !== "Configuracio") {
      sheet.hideSheet();
    }
  });
  spreadsheet.getSheetByName("Configuracio").activate();
}

function protectDatabase_(spreadsheet) {
  Object.keys(TABLES).forEach((name) => {
    const sheet = spreadsheet.getSheetByName(name);
    const existing = sheet
      .getProtections(SpreadsheetApp.ProtectionType.SHEET)
      .find((item) => item.getDescription() === "Protecció de Massa horària");
    const protection = existing || sheet.protect().setDescription("Protecció de Massa horària");
    const editors = protection.getEditors();
    if (editors.length) protection.removeEditors(editors);
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
  });
}

function readTable_(name) {
  if (!Object.prototype.hasOwnProperty.call(TABLES, name)) {
    throw new Error("Taula no permesa.");
  }
  const sheet = getDatabase_().getSheetByName(name);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values
    .slice(1)
    .filter((row) => row.some((value) => value !== ""))
    .map((row) =>
      headers.reduce((record, header, index) => {
        record[header] = row[index];
        return record;
      }, {})
    );
}

function findRowById_(sheetName, id) {
  const sheet = getDatabase_().getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row += 1) {
    if (String(values[row][0]) === id) {
      return { sheet: sheet, row: row + 1, headers: values[0], values: values[row] };
    }
  }
  return null;
}

function appendAudit_(user, action, entity, recordId, before, after) {
  const sheet = getDatabase_().getSheetByName("RegistreCanvis");
  sheet.appendRow([
    new Date(),
    user.email,
    action,
    entity,
    recordId,
    safeJsonForAudit_(before),
    safeJsonForAudit_(after),
  ]);
}

function toBoolean_(value) {
  return value === true || String(value).toLowerCase() === "true" || value === 1;
}

function appendObjects_(sheetName, rows) {
  if (!rows.length) return;
  const headers = TABLES[sheetName];
  const sheet = getDatabase_().getSheetByName(sheetName);
  sheet
    .getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length)
    .setValues(rows.map((row) => headers.map((header) => row[header] ?? "")));
}

function updateRecordById_(sheetName, id, changes) {
  const record = findRowById_(sheetName, id);
  if (!record) throw new Error(`No s'ha trobat el registre ${id}.`);
  const next = rowToObject_(record.headers, record.values);
  Object.keys(changes).forEach((key) => {
    if (!record.headers.includes(key)) throw new Error(`Camp desconegut: ${key}`);
    next[key] = changes[key];
  });
  record.sheet
    .getRange(record.row, 1, 1, record.headers.length)
    .setValues([record.headers.map((header) => next[header])]);
  return next;
}

function removeDefaultSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Full 1");
  if (sheet && spreadsheet.getSheets().length > 1 && sheet.getLastRow() <= 1) {
    spreadsheet.deleteSheet(sheet);
  }
}
