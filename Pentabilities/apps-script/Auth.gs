function loginWithEmail(email, password) {
  ensureDatabase({ syncRosters: true });
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Cal escriure el correu electrònic.');
  let user;
  try {
    user = findUserByEmail(normalizedEmail);
  } catch (error) {
    ensureDatabase({ syncRosters: true, forceSync: true });
    user = findUserByEmail(normalizedEmail);
  }

  if (['professor', 'admin'].includes(user.role) && String(password || '') !== getTeacherPassword()) {
    throw new Error('Contrasenya de professorat incorrecta.');
  }

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(`auth_${token}`, JSON.stringify(user), 21600);
  return buildBootstrapForUser(user, token);
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove(`auth_${token}`);
  return true;
}

function getTeacherPassword() {
  const password = PropertiesService.getScriptProperties().getProperty(APP.teacherPasswordProperty);
  if (!password) {
    throw new Error('Cal configurar la contrasenya del professorat a les propietats del projecte.');
  }
  return password;
}

function getCurrentUser(token) {
  if (token) {
    const cached = CacheService.getScriptCache().get(`auth_${token}`);
    if (cached) return JSON.parse(cached);
    throw new Error('La sessió ha caducat. Torna a entrar.');
  }

  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) throw new Error('Cal iniciar sessió dins l’aplicació.');
  return findUserByEmail(email);
}

function findUserByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const teacher = findBy(SHEETS.teachers, 'email', normalizedEmail);
  if (teacher && String(teacher.actiu).toUpperCase() !== 'FALSE') {
    return {
      email: normalizedEmail,
      role: teacher.rol || 'professor',
      professor_id: teacher.professor_id,
      name: teacher.nom_complet || `${teacher.nom} ${teacher.cognoms}`,
      classe: ''
    };
  }

  const student = findBy(SHEETS.students, 'email', normalizedEmail);
  if (student && String(student.actiu).toUpperCase() !== 'FALSE') {
    return {
      email: normalizedEmail,
      role: 'alumne',
      alumne_id: student.alumne_id,
      name: student.nom_complet || `${student.nom} ${student.cognoms}`,
      classe: student.classe
    };
  }

  if ((APP.adminFallbackEmails || []).includes(normalizedEmail)) {
    return { email: normalizedEmail, role: 'admin', professor_id: 'P_ADMIN', name: 'Felip Sarroca', classe: '' };
  }

  throw new Error('Aquest correu no consta a la llista d’alumnes o professorat.');
}

function requireTeacher(token) {
  const user = getCurrentUser(token);
  if (!['professor', 'admin'].includes(user.role)) {
    throw new Error('Només el professorat pot fer aquesta acció.');
  }
  return user;
}

function requireStudent(token) {
  const user = getCurrentUser(token);
  if (user.role !== 'alumne') {
    throw new Error('Aquesta acció és només per a alumnat.');
  }
  return user;
}

function canAccessSession(user, session) {
  if (!session) return false;
  if (['professor', 'admin'].includes(user.role)) {
    return user.role === 'admin' || session.professor_id === user.professor_id;
  }
  return user.role === 'alumne' && session.classe === user.classe;
}
