function getSessionDashboard(sessioId, token) {
  requireTeacher(token);
  const details = getSessionDetails(sessioId, token);
  const evaluations = readRows(SHEETS.evaluations).filter((row) => row.sessio_id === sessioId);
  return buildDashboard(details, evaluations);
}

function getCycleDashboard(cicleId, token) {
  const user = requireTeacher(token);
  const cycle = findBy(SHEETS.cycles, 'cicle_id', cicleId);
  if (!cycle || (user.role !== 'admin' && cycle.professor_id !== user.professor_id)) throw new Error('No tens accés a aquest cicle.');
  const sessions = readRows(SHEETS.sessions).filter((session) => session.cicle_id === cicleId);
  const sessionIds = new Set(sessions.map((session) => session.sessio_id));
  const evaluations = readRows(SHEETS.evaluations).filter((row) => sessionIds.has(row.sessio_id));
  return {
    cycle,
    sessions,
    evaluationsCount: evaluations.length,
    byBehavior: summarizeBy(evaluations, 'codi_comportament'),
    byType: summarizeBy(evaluations, 'tipus_avaluacio'),
    distribution: distribution(evaluations),
    bySkill: summarizeBySkill(evaluations)
  };
}

function buildDashboard(details, evaluations) {
  const respondentIds = new Set(evaluations.filter((row) => row.avaluador_tipus === 'alumne').map((row) => row.avaluador_id));
  const totalStudents = details.students.length;
  return {
    session: details.session,
    cycle: details.cycle,
    totalStudents,
    respondents: respondentIds.size,
    pending: Math.max(totalStudents - respondentIds.size, 0),
    evaluationsCount: evaluations.length,
    globalAverage: average(evaluations.map((row) => Number(row.valor))),
    byBehavior: summarizeBy(evaluations, 'codi_comportament'),
    byType: summarizeBy(evaluations, 'tipus_avaluacio'),
    distribution: distribution(evaluations),
    bySkill: summarizeBySkill(evaluations)
  };
}

function getSessionProgress(sessioId, token) {
  const details = getSessionDetails(sessioId, token);
  const evaluations = readRows(SHEETS.evaluations).filter((row) => row.sessio_id === sessioId);
  return buildSessionProgress(details, evaluations);
}

function addProgressToSessions(sessions) {
  if (!sessions.length) return [];
  const evaluations = readRows(SHEETS.evaluations);
  const students = readRows(SHEETS.students).filter((student) => String(student.actiu).toUpperCase() !== 'FALSE');
  return sessions.map((session) => {
    const sessionEvaluations = evaluations.filter((row) => row.sessio_id === session.sessio_id);
    const sessionStudents = students.filter((student) => student.classe === session.classe);
    return {
      ...session,
      progress: buildSessionProgress({ students: sessionStudents }, sessionEvaluations)
    };
  });
}

function getTeacherHomeStats(token) {
  const user = requireTeacher(token);
  const sessions = getTeacherSessionsForUser(user, false)
    .filter((session) => session.estat === SESSION_STATUS.open);
  const sessionIds = new Set(sessions.map((session) => session.sessio_id));
  const evaluations = readRows(SHEETS.evaluations)
    .filter((row) => sessionIds.has(row.sessio_id));
  return {
    evaluatedStudents: new Set(evaluations.map((row) => row.avaluat_id).filter(Boolean)).size,
    evaluatedBehaviors: new Set(evaluations.map((row) => row.codi_comportament).filter(Boolean)).size
  };
}

function buildSessionProgress(details, evaluations) {
  const respondentIds = new Set(evaluations.filter((row) => row.avaluador_tipus === 'alumne').map((row) => row.avaluador_id));
  const totalStudents = details.students.length;
  return {
    totalStudents,
    respondents: respondentIds.size,
    pending: Math.max(totalStudents - respondentIds.size, 0),
    evaluationsCount: evaluations.length
  };
}

function distribution(evaluations) {
  return [1, 2, 3, 4, 5].map((value) => ({
    value,
    count: evaluations.filter((row) => Number(row.valor) === value).length
  }));
}

function summarizeBySkill(evaluations) {
  const behaviors = readRows(SHEETS.behaviors);
  const skills = readRows(SHEETS.skills);
  const behaviorToSkill = behaviors.reduce((map, behavior) => {
    const skill = skills.find((item) => item.habilitat_id === behavior.habilitat_id);
    map[behavior.codi_comportament] = skill ? skill.nom_habilitat : behavior.habilitat_id;
    return map;
  }, {});
  return summarizeBy(evaluations.map((row) => ({
    ...row,
    skill: behaviorToSkill[row.codi_comportament] || 'sense_habilitat'
  })), 'skill');
}

function summarizeBy(rows, field) {
  const groups = {};
  rows.forEach((row) => {
    const key = row[field] || 'sense_dades';
    if (!groups[key]) groups[key] = [];
    groups[key].push(Number(row.valor));
  });
  return Object.keys(groups).sort().map((key) => ({
    key,
    count: groups[key].length,
    average: average(groups[key])
  }));
}

function average(values) {
  const filtered = values.filter((value) => !Number.isNaN(value));
  if (!filtered.length) return 0;
  return Math.round((filtered.reduce((sum, value) => sum + value, 0) / filtered.length) * 100) / 100;
}
