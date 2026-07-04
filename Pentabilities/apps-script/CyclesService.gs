function getTeacherCycles(professorId) {
  const user = getCurrentUser();
  return getTeacherCyclesForUser({ role: user.role, professor_id: professorId });
}

function getTeacherCyclesForUser(user) {
  return readRows(SHEETS.cycles)
    .filter((cycle) => cycle.professor_id === user.professor_id || user.role === 'admin')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function createCycle(data, token) {
  const user = requireTeacher(token);
  if (!data.nom_cicle || !data.classe) throw new Error('Cal indicar el nom del cicle i la classe.');
  const cycle = {
    cicle_id: makeId('C'),
    nom_cicle: data.nom_cicle.trim(),
    classe: data.classe,
    professor_id: user.professor_id,
    data_inici: data.data_inici || '',
    data_final: data.data_final || '',
    estat: CYCLE_STATUS.active,
    descripcio: data.descripcio || '',
    created_at: nowIso(),
    updated_at: nowIso()
  };
  appendRow(SHEETS.cycles, cycle);
  return cycle;
}

function closeCycle(cicleId, token) {
  const user = requireTeacher(token);
  const cycle = findBy(SHEETS.cycles, 'cicle_id', cicleId);
  if (!cycle || (user.role !== 'admin' && cycle.professor_id !== user.professor_id)) throw new Error('No tens accés a aquest cicle.');
  updateRowById(SHEETS.cycles, 'cicle_id', cicleId, { estat: CYCLE_STATUS.closed, updated_at: nowIso() });
  return true;
}
