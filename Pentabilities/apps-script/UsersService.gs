function getClasses() {
  return [...new Set(readRows(SHEETS.students).filter((s) => String(s.actiu).toUpperCase() !== 'FALSE').map((s) => s.classe))].sort();
}

function getStudentsByClass(classe, token) {
  if (token) requireTeacher(token);
  return readRows(SHEETS.students)
    .filter((student) => student.classe === classe && String(student.actiu).toUpperCase() !== 'FALSE')
    .sort(compareStudentsByLastName);
}

function compareStudentsByLastName(a, b) {
  const left = `${a.cognoms || ''} ${a.nom || ''} ${a.nom_complet || ''}`;
  const right = `${b.cognoms || ''} ${b.nom || ''} ${b.nom_complet || ''}`;
  return String(left).localeCompare(String(right), 'ca', { sensitivity: 'base' });
}

function getTeachers() {
  return readRows(SHEETS.teachers).filter((teacher) => String(teacher.actiu).toUpperCase() !== 'FALSE');
}

function getSkillsWithBehaviors() {
  const skills = readRows(SHEETS.skills).sort((a, b) => Number(a.ordre) - Number(b.ordre));
  const behaviors = readRows(SHEETS.behaviors).filter((b) => String(b.actiu).toUpperCase() !== 'FALSE');
  return skills.map((skill) => ({
    ...skill,
    behaviors: behaviors
      .filter((behavior) => behavior.habilitat_id === skill.habilitat_id)
      .sort((a, b) => Number(a.ordre) - Number(b.ordre))
  }));
}
