function submitStudentEvaluations(payload, token) {
  const user = requireStudent(token);
  return withScriptLock(() => {
  const details = getSessionByCode(payload.code, token);
  const rows = buildEvaluationRows(details, user, 'alumne', payload.ratings || []);
  return upsertEvaluationRows(rows);
  });
}

function submitTeacherEvaluations(payload, token) {
  const user = requireTeacher(token);
  return withScriptLock(() => {
  const details = getSessionDetails(payload.sessio_id, token);
  if (details.session.estat !== SESSION_STATUS.open) throw new Error('La sessió ha d’estar oberta per enviar valoracions.');
  const rows = buildEvaluationRows(details, user, 'professor', payload.ratings || []);
  return upsertEvaluationRows(rows);
  });
}

function submitStudentEvaluationsAsTeacher(payload, token) {
  const teacher = requireTeacher(token);
  return withScriptLock(() => {
  const details = getSessionDetails(payload.sessio_id, token);
  const student = details.students.find((item) => item.alumne_id === payload.alumne_id);
  if (!student) throw new Error('Aquest alumne no pertany a la sessió.');
  if (details.session.estat !== SESSION_STATUS.open) throw new Error('La sessió ha d’estar oberta per enviar valoracions.');
  const actingStudent = {
    email: `prova:${teacher.email}`,
    role: 'alumne',
    alumne_id: student.alumne_id,
    name: student.nom_complet,
    classe: student.classe
  };
  const rows = buildEvaluationRows(details, actingStudent, 'alumne', payload.ratings || []);
  return upsertEvaluationRows(rows);
  });
}

function getExistingRatingsForUser(sessioId, user) {
  const evaluatorId = user.role === 'alumne' ? user.alumne_id : user.professor_id;
  const evaluatorType = user.role === 'alumne' ? 'alumne' : 'professor';
  if (!evaluatorId) return [];
  return readRows(SHEETS.evaluations)
    .filter((row) => row.sessio_id === sessioId && row.avaluador_id === evaluatorId && row.avaluador_tipus === evaluatorType)
    .map((row) => ({
      avaluat_id: row.avaluat_id,
      codi_comportament: row.codi_comportament,
      value: Number(row.valor)
    }));
}

function upsertEvaluationRows(rows) {
  if (!rows.length) throw new Error('No hi ha cap valoració per desar.');
  const sheet = getDatabase().getSheetByName(SHEETS.evaluations);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const index = {};
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = objectFromRow(headers, values[rowIndex]);
    const key = evaluationKey(row);
    if (key) index[key] = rowIndex + 1;
  }

  let inserted = 0;
  let updated = 0;
  const pending = [];
  rows.forEach((row) => {
    const key = evaluationKey(row);
    const existingRow = index[key];
    if (existingRow) {
      ['timestamp', 'valor', 'tipus_avaluacio'].forEach((field) => {
        const colIndex = headers.indexOf(field);
        if (colIndex >= 0) sheet.getRange(existingRow, colIndex + 1).setValue(row[field]);
      });
      updated += 1;
    } else {
      pending.push(row);
      inserted += 1;
    }
  });

  if (pending.length) {
    const appended = pending.map((row) => headers.map((header) => row[header] ?? ''));
    sheet.getRange(sheet.getLastRow() + 1, 1, appended.length, headers.length).setValues(appended);
  }
  clearRowCache(SHEETS.evaluations);
  return { saved: rows.length, inserted, updated };
}

function evaluationKey(row) {
  if (!row.sessio_id || !row.avaluador_id || !row.avaluador_tipus || !row.avaluat_id || !row.codi_comportament) return '';
  return [row.sessio_id, row.avaluador_id, row.avaluador_tipus, row.avaluat_id, row.codi_comportament].join('|');
}

function buildEvaluationRows(details, user, evaluatorType, ratings) {
  const validBehaviorCodes = new Set(details.behaviors.map((behavior) => behavior.codi_comportament));
  const validStudentIds = new Set(details.students.map((student) => student.alumne_id));
  const rows = [];

  ratings.forEach((rating) => {
    const value = Number(rating.value);
    if (!validStudentIds.has(rating.avaluat_id)) throw new Error('S’ha intentat valorar un alumne que no pertany a la sessió.');
    if (!validBehaviorCodes.has(rating.codi_comportament)) throw new Error('S’ha intentat valorar un comportament que no és en aquesta sessió.');
    if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('Les valoracions han de ser entre 1 i 5.');
    const evaluatorId = evaluatorType === 'professor' ? user.professor_id : user.alumne_id;
    const type = evaluatorType === 'professor'
      ? 'heteroavaluacio'
      : (evaluatorId === rating.avaluat_id ? 'autoavaluacio' : 'coavaluacio');
    rows.push({
      avaluacio_id: makeId('A'),
      timestamp: nowIso(),
      cicle_id: details.session.cicle_id,
      sessio_id: details.session.sessio_id,
      classe: details.session.classe,
      avaluador_id: evaluatorId,
      avaluador_tipus: evaluatorType,
      avaluador_email: user.email,
      avaluat_id: rating.avaluat_id,
      codi_comportament: rating.codi_comportament,
      valor: value,
      tipus_avaluacio: type
    });
  });

  if (!rows.length) throw new Error('No hi ha cap valoració per desar.');
  return rows;
}
