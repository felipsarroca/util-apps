function syncEditableRostersToInternal(spreadsheet) {
  bootstrapEditableRostersIfEmpty(spreadsheet);
  syncStudentsFromRosters(spreadsheet);
  syncTeachersFromRoster(spreadsheet);
  ensureCurrentSchoolYear(spreadsheet);
}

function bootstrapEditableRostersIfEmpty(spreadsheet) {
  ROSTER_SHEETS.forEach((roster) => {
    const rows = readSheetRows(spreadsheet, roster.sheetName);
    if (rows.length) return;
    const internalStudents = readSheetRows(spreadsheet, SHEETS.students)
      .filter((student) => normalizeClassName(student.classe) === normalizeClassName(roster.classe) || normalizeClassName(student.classe) === normalizeLegacyClass(roster.classe))
      .map((student) => ({
        'Nom': student.nom,
        'Cognom': student.cognoms,
        'Correu electrònic': student.email
      }));
    replaceRosterRows(spreadsheet, roster.sheetName, internalStudents);
  });

  const teacherRows = readSheetRows(spreadsheet, ROSTER_TEACHERS_SHEET);
  if (!teacherRows.length) {
    const internalTeachers = readSheetRows(spreadsheet, SHEETS.teachers)
      .map((teacher) => ({
        'Nom': teacher.nom,
        'Cognom': teacher.cognoms,
        'Correu electrònic': teacher.email
      }));
    replaceRosterRows(spreadsheet, ROSTER_TEACHERS_SHEET, internalTeachers);
  }
}

function syncStudentsFromRosters(spreadsheet) {
  const existing = readSheetRows(spreadsheet, SHEETS.students);
  const byEmail = indexBy(existing.filter((student) => student.email), 'email');
  const byNameClass = existing.reduce((map, student) => {
    map[studentKey(student.nom, student.cognoms, student.classe)] = student;
    return map;
  }, {});
  const rows = [];

  ROSTER_SHEETS.forEach((roster) => {
    readSheetRows(spreadsheet, roster.sheetName).forEach((row, index) => {
      const nom = cleanText(row['Nom']);
      const cognoms = cleanText(row['Cognom']);
      const email = cleanEmail(row['Correu electrònic']);
      if (!nom && !cognoms && !email) return;

      const previous = (email && byEmail[email]) || byNameClass[studentKey(nom, cognoms, roster.classe)] || {};
      rows.push({
        alumne_id: previous.alumne_id || `${roster.prefix}_${String(index + 1).padStart(3, '0')}`,
        nom,
        cognoms,
        nom_complet: [nom, cognoms].filter(Boolean).join(' '),
        email,
        classe: roster.classe,
        actiu: true
      });
    });
  });

  if (rows.length) replaceSheetRows(spreadsheet, SHEETS.students, rows);
}

function syncTeachersFromRoster(spreadsheet) {
  const existing = readSheetRows(spreadsheet, SHEETS.teachers);
  const byEmail = indexBy(existing.filter((teacher) => teacher.email), 'email');
  const rows = readSheetRows(spreadsheet, ROSTER_TEACHERS_SHEET)
    .map((row, index) => {
      const nom = cleanText(row['Nom']);
      const cognoms = cleanText(row['Cognom']);
      const email = cleanEmail(row['Correu electrònic']);
      if (!nom && !cognoms && !email) return null;
      const previous = (email && byEmail[email]) || {};
      return {
        professor_id: previous.professor_id || `${email && (APP.adminFallbackEmails || []).includes(email) ? 'P_ADMIN' : `P_${String(index + 1).padStart(3, '0')}`}`,
        nom,
        cognoms,
        nom_complet: [nom, cognoms].filter(Boolean).join(' '),
        email,
        rol: (APP.adminFallbackEmails || []).includes(email) ? 'admin' : (previous.rol || 'professor'),
        actiu: true
      };
    })
    .filter(Boolean);

  (APP.adminFallbackEmails || []).forEach((email) => {
    if (!rows.some((row) => row.email === email)) {
      rows.push({
        professor_id: email === 'felip.sarroca@gmail.com' ? 'P_ADMIN_GMAIL' : 'P_ADMIN',
        nom: 'Felip',
        cognoms: 'Sarroca',
        nom_complet: 'Felip Sarroca',
        email,
        rol: 'admin',
        actiu: true
      });
    }
  });

  if (rows.length) replaceSheetRows(spreadsheet, SHEETS.teachers, rows);
}

function ensureCurrentSchoolYear(spreadsheet) {
  const rows = readSheetRows(spreadsheet, SHEETS.schoolYears);
  if (rows.some((row) => row.estat === 'actiu')) return;
  const sheet = ensureSheet(spreadsheet, SHEETS.schoolYears);
  const values = {
    curs_id: APP.defaultSchoolYear,
    nom_curs: APP.defaultSchoolYear,
    data_inici: '',
    data_final: '',
    estat: 'actiu',
    created_at: nowIso(),
    updated_at: nowIso()
  };
  sheet.appendRow(HEADERS[SHEETS.schoolYears].map((header) => values[header] ?? ''));
}

function getActiveSchoolYear() {
  const active = readRows(SHEETS.schoolYears).find((row) => row.estat === 'actiu');
  return active ? active.nom_curs : APP.defaultSchoolYear;
}

function indexBy(rows, field) {
  return rows.reduce((map, row) => {
    map[String(row[field] || '').trim().toLowerCase()] = row;
    return map;
  }, {});
}

function cleanText(value) {
  return String(value || '').trim();
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function studentKey(nom, cognoms, classe) {
  return `${cleanText(nom).toLowerCase()}|${cleanText(cognoms).toLowerCase()}|${normalizeClassName(classe)}`;
}

function normalizeClassName(classe) {
  return String(classe || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeLegacyClass(classe) {
  return normalizeClassName(classe)
    .replace('1r deso', '1 eso')
    .replace('2n deso', '2 eso')
    .replace('3r deso', '3 eso')
    .replace('4t deso', '4 eso');
}
