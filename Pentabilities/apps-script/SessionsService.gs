function getTeacherSessions(professorId, onlyActive) {
  const user = getCurrentUser();
  return getTeacherSessionsForUser({ role: user.role, professor_id: professorId }, onlyActive);
}

function getTeacherSessionsForUser(user, onlyActive) {
  let sessions = readRows(SHEETS.sessions).filter((session) => session.professor_id === user.professor_id || user.role === 'admin');
  if (onlyActive) sessions = sessions.filter((session) => session.estat !== SESSION_STATUS.closed);
  return sessions.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function createSession(data, token) {
  const user = requireTeacher(token);
  return withScriptLock(() => {
  const cycle = findBy(SHEETS.cycles, 'cicle_id', data.cicle_id);
  if (!cycle || (user.role !== 'admin' && cycle.professor_id !== user.professor_id)) throw new Error('No tens accés a aquest cicle.');
  if (!data.nom_sessio || !Array.isArray(data.behaviors) || data.behaviors.length === 0) throw new Error('Cal indicar nom de sessió i almenys un comportament.');

  const session = {
    sessio_id: makeId('S'),
    cicle_id: cycle.cicle_id,
    nom_sessio: data.nom_sessio.trim(),
    classe: cycle.classe,
    data_sessio: data.data_sessio || '',
    codi_acces: generateSessionCode(),
    estat: data.openNow ? SESSION_STATUS.open : SESSION_STATUS.draft,
    professor_id: user.professor_id,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  appendRow(SHEETS.sessions, session);
  appendRows(SHEETS.sessionBehaviors, data.behaviors.map((code) => ({ sessio_id: session.sessio_id, codi_comportament: code })));
  appendRows(SHEETS.sessionHeteroStudents, (data.heteroStudents || []).map((studentId) => ({ sessio_id: session.sessio_id, alumne_id: studentId })));
  return getSessionDetails(session.sessio_id, token);
  });
}

function generateSessionCode() {
  const existing = new Set(readRows(SHEETS.sessions).map((session) => String(session.codi_acces)));
  let code = '';
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (existing.has(code));
  return code;
}

function openSession(sessioId, token) {
  updateSessionStatus(sessioId, SESSION_STATUS.open, token);
  return getSessionDetails(sessioId, token);
}

function closeSession(sessioId, token) {
  updateSessionStatus(sessioId, SESSION_STATUS.closed, token);
  return getSessionDetails(sessioId, token);
}

function updateSessionStatus(sessioId, status, token) {
  const user = requireTeacher(token);
  const session = findBy(SHEETS.sessions, 'sessio_id', sessioId);
  if (!session || (user.role !== 'admin' && session.professor_id !== user.professor_id)) throw new Error('No tens accés a aquesta sessió.');
  updateRowById(SHEETS.sessions, 'sessio_id', sessioId, { estat: status, updated_at: nowIso() });
}

function getSessionDetails(sessioId, token) {
  const user = requireTeacher(token);
  const session = findBy(SHEETS.sessions, 'sessio_id', sessioId);
  if (!canAccessSession(user, session)) throw new Error('No tens accés a aquesta sessió.');
  return buildSessionDetails(session, user);
}

function buildSessionDetails(session, user) {
  const cycle = findBy(SHEETS.cycles, 'cicle_id', session.cicle_id);
  const behaviorCodes = readRows(SHEETS.sessionBehaviors).filter((row) => row.sessio_id === session.sessio_id).map((row) => row.codi_comportament);
  const behaviors = readRows(SHEETS.behaviors).filter((behavior) => behaviorCodes.includes(behavior.codi_comportament));
  const heteroIds = readRows(SHEETS.sessionHeteroStudents).filter((row) => row.sessio_id === session.sessio_id).map((row) => row.alumne_id);
  const students = getStudentsByClass(session.classe);
  const existingRatings = user ? getExistingRatingsForUser(session.sessio_id, user) : [];
  return { session, cycle, behaviors, students, heteroStudentIds: heteroIds, existingRatings };
}

function getSessionByCode(code, token) {
  const user = getCurrentUser(token);
  const session = findBy(SHEETS.sessions, 'codi_acces', String(code).trim());
  if (!session) throw new Error('Aquest codi no existeix.');
  if (session.estat === SESSION_STATUS.draft) throw new Error('Aquesta sessió encara no està oberta.');
  if (session.estat === SESSION_STATUS.closed) throw new Error('La sessió ja està tancada.');
  if (!canAccessSession(user, session)) throw new Error('Aquesta sessió no correspon a la teva classe.');
  return buildSessionDetails(session, user);
}
