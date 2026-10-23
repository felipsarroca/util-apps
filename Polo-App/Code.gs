const SHEET_ALUMNAT = 'Alumnat';
const SHEET_REGISTRES = 'Registres';

const HEADERS_ALUMNAT = [
  'id_alumne',
  'nom_complet',
  'curs',
  'actiu'
];

const HEADERS_REGISTRES = [
  'id_registre',
  'timestamp',
  'data',
  'hora',
  'any',
  'mes',
  'trimestre',
  'dia_setmana_num',
  'dia_setmana_text',
  'id_alumne',
  'nom_complet',
  'curs',
  'clau_unica'
];

const CURSOS = ['1r ESO', '2n ESO', '3r ESO', '4t ESO'];
const WEEKDAY_LABELS = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
const STUDENTS_CACHE_KEY = 'alumnat_v2';
const STUDENTS_CACHE_SECONDS = 600;

let sheetsChecked = false;

// Buida la memòria cau de l'alumnat quan s'edita la pestanya Alumnat.
function onEdit(e) {
  if (e && e.range && e.range.getSheet().getName() === SHEET_ALUMNAT) {
    CacheService.getScriptCache().remove(STUDENTS_CACHE_KEY);
  }
}

function setupSheets() {
  if (sheetsChecked) {
    return { ok: true, message: 'Estructura del full correcta.', cursos: CURSOS };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const alumnatSheet = ss.getSheetByName(SHEET_ALUMNAT);
  const registresSheet = ss.getSheetByName(SHEET_REGISTRES);

  if (!alumnatSheet) {
    throw new Error(`No existeix la pestanya "${SHEET_ALUMNAT}".`);
  }

  if (!registresSheet) {
    throw new Error(`No existeix la pestanya "${SHEET_REGISTRES}".`);
  }

  const alumnatHeaders = alumnatSheet.getRange(1, 1, 1, HEADERS_ALUMNAT.length).getValues()[0];
  const registresHeaders = registresSheet.getRange(1, 1, 1, HEADERS_REGISTRES.length).getValues()[0];

  if (!headersStartWith(alumnatHeaders, HEADERS_ALUMNAT)) {
    throw new Error(
      `Les capçaleres de "${SHEET_ALUMNAT}" no són correctes. Han de ser: ${HEADERS_ALUMNAT.join(', ')}`
    );
  }

  if (!headersStartWith(registresHeaders, HEADERS_REGISTRES)) {
    throw new Error(
      `Les capçaleres de "${SHEET_REGISTRES}" no són correctes. Han de ser: ${HEADERS_REGISTRES.join(', ')}`
    );
  }

  sheetsChecked = true;

  return {
    ok: true,
    message: 'Estructura del full correcta.',
    cursos: CURSOS
  };
}

function headersStartWith(actual, expected) {
  if (actual.length < expected.length) {
    return false;
  }

  for (let i = 0; i < expected.length; i++) {
    if (String(actual[i]).trim() !== String(expected[i]).trim()) {
      return false;
    }
  }

  return true;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function getScriptTimeZone() {
  return Session.getScriptTimeZone()
    || SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone()
    || 'Europe/Madrid';
}

function normalizeStudentId(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(value).trim();
  }

  const normalized = normalizeText(value);
  return normalized.replace(/\.0+$/, '');
}

function normalizeActiveValue(value) {
  const cleanValue = normalizeText(value).toLowerCase();

  if (cleanValue === '') {
    return true;
  }

  return !['false', '0', 'no', 'inactive', 'inactiu'].includes(cleanValue);
}

// Llegeix tot l'alumnat (també l'inactiu) i el desa a la memòria cau de l'script.
function readStudentRows() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(STUDENTS_CACHE_KEY);

  if (cached) {
    return JSON.parse(cached);
  }

  setupSheets();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ALUMNAT);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS_ALUMNAT.length).getValues();

  const students = values
    .map(row => ({
      id_alumne: normalizeStudentId(row[0]),
      nom_complet: normalizeText(row[1]),
      curs: normalizeText(row[2]),
      actiu: normalizeActiveValue(row[3])
    }))
    .filter(student => student.id_alumne && student.nom_complet && student.curs)
    .sort((a, b) => a.nom_complet.localeCompare(b.nom_complet, 'ca'));

  try {
    cache.put(STUDENTS_CACHE_KEY, JSON.stringify(students), STUDENTS_CACHE_SECONDS);
  } catch (error) {
    // Si la llista no cap a la memòria cau, es continua llegint del full.
  }

  return students;
}

function getAllStudents() {
  return readStudentRows().filter(student => student.actiu);
}

function getStudentsByCourse(curs) {
  setupSheets();

  if (!CURSOS.includes(curs)) {
    throw new Error(`Curs no vàlid: ${curs}`);
  }

  return getAllStudents().filter(student => student.curs === curs);
}

function getStudentById(studentId) {
  const cleanStudentId = normalizeStudentId(studentId);
  const students = getAllStudents();
  return students.find(student => student.id_alumne === cleanStudentId) || null;
}

function getWeekdayInfoFromDateString(dateString) {
  const parts = String(dateString).split('-');

  if (parts.length !== 3) {
    return {
      dayNumberJs: -1,
      dayNumberIso: -1,
      label: ''
    };
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  const date = new Date(year, month - 1, day);
  const dayNumberJs = date.getDay();
  const dayNumberIso = dayNumberJs === 0 ? 7 : dayNumberJs;

  return {
    dayNumberJs: dayNumberJs,
    dayNumberIso: dayNumberIso,
    label: WEEKDAY_LABELS[dayNumberJs] || ''
  };
}

function getNowInfo() {
  const now = new Date();
  const tz = getScriptTimeZone();

  const data = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const monthNumber = Number(Utilities.formatDate(now, tz, 'M'));
  const year = Utilities.formatDate(now, tz, 'yyyy');
  const quarter = Math.ceil(monthNumber / 3);
  const weekdayInfo = getWeekdayInfoFromDateString(data);

  return {
    timestamp: Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss'),
    data: data,
    hora: Utilities.formatDate(now, tz, 'HH:mm:ss'),
    any: year,
    mes: Utilities.formatDate(now, tz, 'yyyy-MM'),
    trimestre: `${year}-T${quarter}`,
    diaSetmanaNum: weekdayInfo.dayNumberIso,
    diaSetmanaText: weekdayInfo.label
  };
}

function getSchoolYearStart(dateString) {
  const year = Number(dateString.slice(0, 4));
  const month = Number(dateString.slice(5, 7));
  return `${month >= 9 ? year : year - 1}-09-01`;
}

// Una sola lectura: qui està marcat avui i quantes vegades aquest curs escolar.
function getRegisterStats(today) {
  setupSheets();

  const stats = { todayIds: new Set(), yearCounts: {} };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_REGISTRES);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return stats;
  }

  const yearStart = getSchoolYearStart(today);
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTRES.length).getValues();

  values.forEach(row => {
    const id = normalizeStudentId(row[9]);
    const rowDate = normalizeDateValue(row[2]);

    if (!id) {
      return;
    }

    if (rowDate === today || normalizeText(row[12]).indexOf(`${today}|`) === 0) {
      stats.todayIds.add(id);
    }

    if (rowDate >= yearStart && rowDate <= today) {
      stats.yearCounts[id] = (stats.yearCounts[id] || 0) + 1;
    }
  });

  return stats;
}

function getTodayRegisteredStudentIds() {
  return [...getRegisterStats(getNowInfo().data).todayIds];
}

// Sense curs, retorna l'alumnat de tots els cursos en una sola crida.
function getStudentsForCourse(curs) {
  const students = curs ? getStudentsByCourse(curs) : getAllStudents();
  const today = getNowInfo().data;
  const stats = getRegisterStats(today);

  const enrichedStudents = students.map(student => ({
    id_alumne: student.id_alumne,
    nom_complet: student.nom_complet,
    curs: student.curs,
    registeredToday: stats.todayIds.has(student.id_alumne),
    yearCount: stats.yearCounts[student.id_alumne] || 0
  }));

  return {
    students: enrichedStudents,
    markedTodayCount: enrichedStudents.filter(student => student.registeredToday).length,
    today: today
  };
}

function uniqueKeyExists(sheet, uniqueKey) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  const keyColumn = HEADERS_REGISTRES.indexOf('clau_unica') + 1;
  const range = sheet.getRange(2, keyColumn, lastRow - 1, 1);
  const finder = range.createTextFinder(uniqueKey).matchEntireCell(true);
  return finder.findNext() !== null;
}

function registerStudent(studentId) {
  setupSheets();

  if (!studentId || !normalizeText(studentId)) {
    throw new Error('Cal indicar un id dalumne vàlid.');
  }

  const cleanStudentId = normalizeStudentId(studentId);
  const student = getStudentById(cleanStudentId);

  if (!student) {
    throw new Error(`No existeix cap alumne amb id ${cleanStudentId}.`);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_REGISTRES);

    const nowInfo = getNowInfo();
    const uniqueKey = `${nowInfo.data}|${student.id_alumne}`;

    if (uniqueKeyExists(sheet, uniqueKey)) {
      return {
        success: true,
        status: 'duplicate',
        message: 'Ja estava registrat avui',
        data: nowInfo.data,
        student: student
      };
    }

    sheet.appendRow([
      Utilities.getUuid(),
      nowInfo.timestamp,
      nowInfo.data,
      nowInfo.hora,
      nowInfo.any,
      nowInfo.mes,
      nowInfo.trimestre,
      nowInfo.diaSetmanaNum,
      nowInfo.diaSetmanaText,
      student.id_alumne,
      student.nom_complet,
      student.curs,
      uniqueKey
    ]);

    return {
      success: true,
      status: 'registered',
      message: 'Registrat',
      data: nowInfo.data,
      student: student
    };
  } finally {
    lock.releaseLock();
  }
}

// Només permet desfer el registre del mateix dia.
function unregisterStudent(studentId) {
  setupSheets();

  const cleanStudentId = normalizeStudentId(studentId);

  if (!cleanStudentId) {
    throw new Error('Cal indicar un id dalumne vàlid.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_REGISTRES);
    const lastRow = sheet.getLastRow();
    const today = getNowInfo().data;
    const uniqueKey = `${today}|${cleanStudentId}`;

    if (lastRow < 2) {
      return { success: true, status: 'not_found', message: 'No hi havia cap registre avui', data: today };
    }

    const keyColumn = HEADERS_REGISTRES.indexOf('clau_unica') + 1;
    const matches = sheet
      .getRange(2, keyColumn, lastRow - 1, 1)
      .createTextFinder(uniqueKey)
      .matchEntireCell(true)
      .findAll();

    if (matches.length === 0) {
      return { success: true, status: 'not_found', message: 'No hi havia cap registre avui', data: today };
    }

    matches
      .map(cell => cell.getRow())
      .sort((a, b) => b - a)
      .forEach(row => sheet.deleteRow(row));

    return {
      success: true,
      status: 'unregistered',
      message: 'Registre desfet',
      data: today,
      studentId: cleanStudentId
    };
  } finally {
    lock.releaseLock();
  }
}

// Dades compactes perquè l'app calculi tots els resums i filtres al dispositiu.
function getDashboardData() {
  setupSheets();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_REGISTRES);
  const lastRow = sheet.getLastRow();
  const studentsById = {};

  const registers = lastRow < 2
    ? []
    : sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTRES.length).getValues()
      .map(row => {
        const id = normalizeStudentId(row[9]);
        const data = normalizeDateValue(row[2]);
        const curs = normalizeText(row[11]);

        if (id && !studentsById[id]) {
          studentsById[id] = [id, normalizeText(row[10]), curs, false];
        }

        return [data, id, curs];
      })
      .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row[0]) && row[1]);

  readStudentRows().forEach(student => {
    studentsById[student.id_alumne] = [student.id_alumne, student.nom_complet, student.curs, student.actiu];
  });

  return {
    today: getNowInfo().data,
    courses: CURSOS,
    students: Object.values(studentsById),
    registers: registers
  };
}

function normalizeDateValue(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const textValue = normalizeText(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(textValue)) {
    return textValue;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(textValue)) {
    const parts = textValue.split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }

  return textValue;
}

function getAllRegisters() {
  setupSheets();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_REGISTRES);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTRES.length).getValues();

  return values
      .map(row => ({
        id_registre: normalizeText(row[0]),
        timestamp: normalizeText(row[1]),
        data: normalizeDateValue(row[2]),
        hora: normalizeText(row[3]),
      any: normalizeText(row[4]),
      mes: normalizeText(row[5]),
      trimestre: normalizeText(row[6]),
      dia_setmana_num: Number(row[7]) || 0,
      dia_setmana_text: normalizeText(row[8]),
        id_alumne: normalizeStudentId(row[9]),
        nom_complet: normalizeText(row[10]),
        curs: normalizeText(row[11]),
        clau_unica: normalizeText(row[12])
    }))
    .filter(row => row.data && row.id_alumne);
}

function getOverviewSummary() {
  const registers = getAllRegisters();

  if (registers.length === 0) {
    return {
      totalRegisters: 0,
      topCourse: null,
      topStudent: null,
      latestRecordDate: null
    };
  }

  const courseTotals = {};
  const studentTotals = {};
  let latestRecordDate = registers[0].data;

  registers.forEach(record => {
    courseTotals[record.curs] = (courseTotals[record.curs] || 0) + 1;

    if (!studentTotals[record.id_alumne]) {
      studentTotals[record.id_alumne] = {
        id_alumne: record.id_alumne,
        nom_complet: record.nom_complet,
        curs: record.curs,
        total: 0
      };
    }

    studentTotals[record.id_alumne].total += 1;

    if (record.data > latestRecordDate) {
      latestRecordDate = record.data;
    }
  });

  const topCourseEntry = Object.entries(courseTotals).sort((a, b) => b[1] - a[1])[0];
  const topStudent = Object.values(studentTotals).sort((a, b) => b.total - a.total)[0];

  return {
    totalRegisters: registers.length,
    topCourse: topCourseEntry
      ? {
          curs: topCourseEntry[0],
          total: topCourseEntry[1]
        }
      : null,
    topStudent: topStudent || null,
    latestRecordDate: latestRecordDate
  };
}

function getCourseSummary() {
  const students = getAllStudents();
  const registers = getAllRegisters();

  const totalsByCourse = {};
  const studentsWithIncidentsByCourse = {};

  CURSOS.forEach(curs => {
    totalsByCourse[curs] = 0;
    studentsWithIncidentsByCourse[curs] = new Set();
  });

  registers.forEach(record => {
    totalsByCourse[record.curs] = (totalsByCourse[record.curs] || 0) + 1;

    if (!studentsWithIncidentsByCourse[record.curs]) {
      studentsWithIncidentsByCourse[record.curs] = new Set();
    }

    studentsWithIncidentsByCourse[record.curs].add(record.id_alumne);
  });

  const studentCountByCourse = {};
  students.forEach(student => {
    studentCountByCourse[student.curs] = (studentCountByCourse[student.curs] || 0) + 1;
  });

  const courseSummary = CURSOS.map(curs => {
    const totalStudents = studentCountByCourse[curs] || 0;
    const totalRegisters = totalsByCourse[curs] || 0;
    const average = totalStudents > 0 ? (totalRegisters / totalStudents).toFixed(2) : '0.00';

    return {
      curs: curs,
      totalRegisters: totalRegisters,
      totalStudents: totalStudents,
      studentsWithIncidents: studentsWithIncidentsByCourse[curs]
        ? studentsWithIncidentsByCourse[curs].size
        : 0,
      averagePerStudent: average
    };
  });

  const topCourse = [...courseSummary].sort((a, b) => b.totalRegisters - a.totalRegisters)[0] || null;

  return {
    courses: courseSummary,
    topCourse: topCourse
  };
}

function getStudentSummary() {
  const registers = getAllRegisters();

  if (registers.length === 0) {
    return { students: [] };
  }

  const studentTotals = {};

  registers.forEach(record => {
    if (!studentTotals[record.id_alumne]) {
      studentTotals[record.id_alumne] = {
        id_alumne: record.id_alumne,
        nom_complet: record.nom_complet,
        curs: record.curs,
        totalRegisters: 0,
        lastDate: record.data,
        history: []
      };
    }

    studentTotals[record.id_alumne].totalRegisters += 1;
    studentTotals[record.id_alumne].history.push({
      data: record.data,
      diaSetmana: record.dia_setmana_text || getWeekdayInfoFromDateString(record.data).label
    });

    if (record.data > studentTotals[record.id_alumne].lastDate) {
      studentTotals[record.id_alumne].lastDate = record.data;
    }
  });

  Object.values(studentTotals).forEach(student => {
    student.history.sort((a, b) => b.data.localeCompare(a.data));
  });

  const students = Object.values(studentTotals)
    .sort((a, b) => {
      if (b.totalRegisters !== a.totalRegisters) {
        return b.totalRegisters - a.totalRegisters;
      }
      return a.nom_complet.localeCompare(b.nom_complet, 'ca');
    })
    .slice(0, 50);

  return {
    students: students
  };
}

function getWeekdaySummary() {
  const registers = getAllRegisters();

  const weekdayOrder = [1, 2, 3, 4, 5];
  const weekdayTotals = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  };

  registers.forEach(record => {
    const weekday = record.dia_setmana_num || getWeekdayInfoFromDateString(record.data).dayNumberIso;
    if (weekdayTotals[weekday] !== undefined) {
      weekdayTotals[weekday] += 1;
    }
  });

  const days = weekdayOrder.map(dayNumber => ({
    dayNumber: dayNumber,
    label: WEEKDAY_LABELS[dayNumber === 7 ? 0 : dayNumber],
    totalRegisters: weekdayTotals[dayNumber]
  }));

  const topDay = [...days].sort((a, b) => b.totalRegisters - a.totalRegisters)[0] || null;

  return {
    days: days,
    topDay: topDay
  };
}

function buildJsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleRequest(action, params) {
  if (action === 'getStudents') {
    const curs = params.curs;
    const result = getStudentsForCourse(curs);

    return {
      success: true,
      students: result.students,
      markedTodayCount: result.markedTodayCount,
      today: result.today
    };
  }

  if (action === 'registerStudent') {
    const studentId = params.studentId;
    return registerStudent(studentId);
  }

  if (action === 'unregisterStudent') {
    return unregisterStudent(params.studentId);
  }

  if (action === 'getDashboard') {
    return {
      success: true,
      summary: getDashboardData()
    };
  }

  if (action === 'getOverviewSummary') {
    return {
      success: true,
      summary: getOverviewSummary()
    };
  }

  if (action === 'getCourseSummary') {
    return {
      success: true,
      summary: getCourseSummary()
    };
  }

  if (action === 'getStudentSummary') {
    return {
      success: true,
      summary: getStudentSummary()
    };
  }

  if (action === 'getWeekdaySummary') {
    return {
      success: true,
      summary: getWeekdaySummary()
    };
  }

  return {
    success: false,
    message: 'Accio no valida.'
  };
}

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : '';
    const params = e && e.parameter ? e.parameter : {};

    return buildJsonResponse(handleRequest(action, params));
  } catch (error) {
    return buildJsonResponse({
      success: false,
      message: error.message
    });
  }
}

function doPost(e) {
  try {
    let payload = {};

    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const action = payload.action || '';
    return buildJsonResponse(handleRequest(action, payload));
  } catch (error) {
    return buildJsonResponse({
      success: false,
      message: error.message
    });
  }
}
