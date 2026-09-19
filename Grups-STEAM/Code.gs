const CONFIG = Object.freeze({
  sourceSheet: "Resum! '26-27",
  rosterSheet: "Curs! '26-27",
  derivedSheets: [
    { name: "Grup! '26-27", keys: ["group", "name"] },
    { name: "Grup-Curs! '26-27", keys: ["group", "course", "name"] },
    { name: "Curs-Grup! '26-27", keys: ["course", "group", "name"] },
  ],
  sourceFirstRow: 2,
  sourceLastRow: 29,
  sourceFirstColumn: 2,
  groupHeadersRow: 1,
  rosterFirstRow: 2,
  rosterCapacity: 126,
});

const GROUP_ORDER = ["Alfa", "Beta", "Gamma", "Delta", "Èpsilon"];
const COURSE_ORDER = ["1r.ESO", "2n.ESO", "3r.ESO", "4t.ESO"];

/** Sincronització automàtica quan el professorat edita la pestanya d'entrada. */
function handleSourceEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.sourceSheet) return;
  if (e.range.getRow() > CONFIG.sourceLastRow) return;
  if (e.range.getLastColumn() < CONFIG.sourceFirstColumn || e.range.getColumn() > 6) return;
  syncStudentSheets();
}

/** Executa una sincronització manual sense haver d'editar la pestanya d'entrada. */
function syncNow() {
  syncStudentSheets();
}

/** Instal·la un únic activador instal·lable per a les edicions del full. */
function installSyncTrigger() {
  const spreadsheet = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter((trigger) => ["onEdit", "handleSourceEdit"].includes(trigger.getHandlerFunction()))
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("handleSourceEdit").forSpreadsheet(spreadsheet).onEdit().create();
}

function syncStudentSheets() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    syncStudentSheetsLocked_();
  } finally {
    lock.releaseLock();
  }
}

function syncStudentSheetsLocked_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const source = spreadsheet.getSheetByName(CONFIG.sourceSheet);
  const roster = spreadsheet.getSheetByName(CONFIG.rosterSheet);
  if (!source || !roster) {
    throw new Error("No s'han trobat les pestanyes d'entrada i de llistat.");
  }

  const emailByName = readEmailMap_(roster);
  const students = readStudents_(source, emailByName);
  const missingEmails = students.filter((student) => !student.email);
  if (missingEmails.length > 0) {
    throw new Error("Falta el correu d'un o més alumnes; s'atura la sincronització per no sobreescriure cap adreça.");
  }
  const byRosterOrder = sortStudents_(students, ["course", "name"]);
  writeRoster_(roster, byRosterOrder);

  const rosterRowByKey = new Map(
    byRosterOrder.map((student, index) => [student.key, CONFIG.rosterFirstRow + index])
  );
  CONFIG.derivedSheets.forEach((definition) => {
    const sheet = spreadsheet.getSheetByName(definition.name);
    if (!sheet) throw new Error(`No s'ha trobat la pestanya ${definition.name}.`);
    const ordered = sortStudents_(students, definition.keys);
    writeDerivedFormulas_(sheet, ordered, rosterRowByKey);
  });
  SpreadsheetApp.flush();
}

function readStudents_(source, emailByName) {
  const headerValues = source
    .getRange(CONFIG.groupHeadersRow, CONFIG.sourceFirstColumn, 1, GROUP_ORDER.length)
    .getDisplayValues()[0];
  const groups = headerValues.map(canonicalGroup_);
  const values = source
    .getRange(
      CONFIG.sourceFirstRow,
      1,
      CONFIG.sourceLastRow - CONFIG.sourceFirstRow + 1,
      GROUP_ORDER.length + 1
    )
    .getDisplayValues();

  const students = [];
  let course = "";
  values.forEach((row) => {
    if (row[0]) course = row[0].trim();
    if (!course || !COURSE_ORDER.includes(course)) return;
    groups.forEach((group, index) => {
      const name = (row[index + 1] || "").trim();
      if (!name || /^\d+$/.test(name)) return;
      const nameKey = studentKey_(name);
      const key = [nameKey, group, course].join("\u0001");
      students.push({
        name,
        group,
        course,
        email: emailByName.get(nameKey) || "",
        key,
      });
    });
  });
  return students;
}

function readEmailMap_(roster) {
  const values = roster
    .getRange(CONFIG.rosterFirstRow, 1, CONFIG.rosterCapacity, 4)
    .getDisplayValues();
  const emailByName = new Map();
  values.forEach((row) => {
    const name = (row[0] || "").trim();
    if (name && row[3]) emailByName.set(studentKey_(name), row[3]);
  });
  if (emailByName.size === 0) {
    throw new Error("No s'han pogut llegir els correus de la pestanya Curs; s'atura la sincronització per evitar pèrdues.");
  }
  return emailByName;
}

function writeRoster_(roster, students) {
  const output = Array.from({ length: CONFIG.rosterCapacity }, (_, index) => {
    const student = students[index];
    return student ? [student.name, student.group, student.course, student.email] : ["", "", "", ""];
  });
  roster.getRange(CONFIG.rosterFirstRow, 1, CONFIG.rosterCapacity, 4).setValues(output);
}

function writeDerivedFormulas_(sheet, students, rosterRowByKey) {
  const rosterName = quoteSheetName_(CONFIG.rosterSheet);
  const formulas = Array.from({ length: CONFIG.rosterCapacity }, (_, index) => {
    const student = students[index];
    if (!student) return ["", "", "", ""];
    const rosterRow = rosterRowByKey.get(student.key);
    return ["A", "B", "C", "D"].map((column) => `=${rosterName}!${column}${rosterRow}`);
  });
  sheet.getRange(CONFIG.rosterFirstRow, 1, CONFIG.rosterCapacity, 4).setFormulas(formulas);
}

function sortStudents_(students, keys) {
  const collator = new Intl.Collator("ca", { sensitivity: "base", numeric: true });
  return students.slice().sort((left, right) => {
    for (const key of keys) {
      const comparison = rank_(key, left[key]) - rank_(key, right[key]);
      if (comparison !== 0) return comparison;
      if (key === "name") {
        const nameComparison = collator.compare(left.name, right.name);
        if (nameComparison !== 0) return nameComparison;
      }
    }
    return collator.compare(left.name, right.name);
  });
}

function rank_(key, value) {
  if (key === "group") return GROUP_ORDER.indexOf(value);
  if (key === "course") return COURSE_ORDER.indexOf(value);
  return 0;
}

function canonicalGroup_(value) {
  const normalized = String(value || "").trim().toUpperCase();
  const match = GROUP_ORDER.find((group) => group.toUpperCase() === normalized);
  if (!match) throw new Error(`Grup no reconegut a la fila d'encapçalament: ${value}`);
  return match;
}

function studentKey_(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ca");
}

function quoteSheetName_(name) {
  return `'${name.replace(/'/g, "''")}'`;
}
