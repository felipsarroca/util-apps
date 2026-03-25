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

function setupSheets() {
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

function getAllStudents() {
  setupSheets();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ALUMNAT);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS_ALUMNAT.length).getValues();

  return values
    .map(row => ({
      id_alumne: normalizeStudentId(row[0]),
      nom_complet: normalizeText(row[1]),
      curs: normalizeText(row[2]),
      actiu: normalizeActiveValue(row[3])
    }))
    .filter(student => student.id_alumne && student.nom_complet && student.curs && student.actiu)
    .sort((a, b) => a.nom_complet.localeCompare(b.nom_complet, 'ca'));
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

function getTodayRegisteredStudentIds() {
  setupSheets();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_REGISTRES);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const today = getNowInfo().data;
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTRES.length).getValues();

  return [...new Set(
    values
      .filter(row => {
        const rowDate = normalizeDateValue(row[2]);
        const uniqueKey = normalizeText(row[12]);
        return rowDate === today || uniqueKey.indexOf(`${today}|`) === 0;
      })
      .map(row => normalizeStudentId(row[9]))
      .filter(Boolean)
  )];
}

function getStudentsForCourse(curs) {
  const students = getStudentsByCourse(curs);
  const todayIds = new Set(getTodayRegisteredStudentIds());

  const enrichedStudents = students.map(student => ({
    id_alumne: student.id_alumne,
    nom_complet: student.nom_complet,
    curs: student.curs,
    registeredToday: todayIds.has(normalizeStudentId(student.id_alumne))
  }));

  return {
    students: enrichedStudents,
    markedTodayCount: enrichedStudents.filter(student => student.registeredToday).length,
    today: getNowInfo().data
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
        lastDate: record.data
      };
    }

    studentTotals[record.id_alumne].totalRegisters += 1;

    if (record.data > studentTotals[record.id_alumne].lastDate) {
      studentTotals[record.id_alumne].lastDate = record.data;
    }
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
