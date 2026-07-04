function doPost(event) {
  try {
    const request = parseApiRequest(event);
    const result = handleApiAction(request.action, request.payload || {}, request.token || '');
    return jsonResponse({ ok: true, data: result });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || String(error) });
  }
}

function parseApiRequest(event) {
  const raw = event && event.postData && event.postData.contents ? event.postData.contents : '{}';
  return JSON.parse(raw);
}

function handleApiAction(action, payload, token) {
  switch (action) {
    case 'app_bootstrap':
      return token ? toPublicBootstrap(refreshSession(token)) : appBootstrap();
    case 'login':
      return toPublicBootstrap(loginWithEmail(payload.email, payload.password || ''));
    case 'logout':
      return logout(token);
    case 'refresh':
      return toPublicBootstrap(refreshSession(token));
    case 'create_cycle':
      createCycle(mapPublicCycle(payload), token);
      return toPublicBootstrap(refreshSession(token));
    case 'create_session':
      return toPublicDetails(createSession(mapPublicSession(payload), token));
    case 'students_by_class':
      requireTeacher(token);
      return getStudentsByClass(payload.classGroup).map(toPublicStudent);
    case 'teacher_home_stats':
      return getTeacherHomeStats(token);
    case 'sync_roster_to_supabase':
      return syncPublicRosterToSupabase();
    case 'session_by_code':
      return toPublicDetails(getSessionByCode(payload.code, token));
    case 'session_details':
      return toPublicDetails(getSessionDetails(payload.sessionId, token));
    case 'submit_student_evaluations':
      return submitStudentEvaluations({ code: payload.code, ratings: mapPublicRatings(payload.ratings || []) }, token);
    case 'submit_teacher_evaluations':
      return submitTeacherEvaluations({ sessio_id: payload.sessionId, ratings: mapPublicRatings(payload.ratings || []) }, token);
    case 'session_dashboard':
      return getSessionDashboard(payload.sessionId, token);
    case 'cycle_dashboard':
      return getCycleDashboard(payload.cycleId, token);
    case 'close_session':
      return toPublicDetails(closeSession(payload.sessionId, token));
    case 'open_session':
      return toPublicDetails(openSession(payload.sessionId, token));
    default:
      throw new Error('Acció API no reconeguda.');
  }
}

function toPublicBootstrap(boot) {
  return {
    app: boot.app,
    token: boot.token,
    user: toPublicUser(boot.user),
    databaseUrl: boot.databaseUrl,
    rosterSheets: boot.rosterSheets,
    classes: boot.classes,
    skills: (boot.skills || []).map(toPublicSkill),
    cycles: (boot.cycles || []).map(toPublicCycle),
    activeSessions: (boot.activeSessions || []).map(toPublicSession)
  };
}

function toPublicUser(user) {
  if (!user) return user;
  return {
    id: user.role === 'alumne' ? user.alumne_id : user.professor_id,
    email: user.email,
    name: user.name,
    role: user.role === 'alumne' ? 'student' : user.role,
    classGroup: user.classe || ''
  };
}

function toPublicSkill(skill) {
  return {
    id: skill.habilitat_id,
    code: skill.codi_habilitat,
    name: skill.nom_habilitat,
    color: skill.color,
    behaviors: (skill.behaviors || []).map(toPublicBehavior)
  };
}

function toPublicBehavior(behavior) {
  return {
    id: behavior.codi_comportament,
    code: behavior.codi_comportament,
    name: behavior.nom_comportament
  };
}

function toPublicCycle(cycle) {
  return {
    id: cycle.cicle_id,
    name: cycle.nom_cicle,
    classGroup: cycle.classe,
    status: cycle.estat === 'actiu' ? 'active' : cycle.estat,
    startsOn: cycle.data_inici || '',
    endsOn: cycle.data_final || '',
    notes: cycle.descripcio || ''
  };
}

function toPublicSession(session) {
  return {
    id: session.sessio_id,
    cycleId: session.cicle_id,
    name: session.nom_sessio,
    classGroup: session.classe,
    sessionDate: session.data_sessio || '',
    accessCode: session.codi_acces,
    status: toPublicStatus(session.estat),
    progress: session.progress || {}
  };
}

function toPublicStatus(status) {
  if (status === SESSION_STATUS.open) return 'open';
  if (status === SESSION_STATUS.draft) return 'draft';
  if (status === SESSION_STATUS.closed) return 'closed';
  return status;
}

function toPublicStudent(student) {
  return {
    id: student.alumne_id,
    name: student.nom_complet,
    email: student.email,
    classGroup: student.classe
  };
}

function toPublicDetails(details) {
  return {
    session: toPublicSession(details.session),
    cycle: toPublicCycle(details.cycle),
    behaviors: (details.behaviors || []).map(toPublicBehavior),
    students: (details.students || []).map(toPublicStudent),
    heteroStudentIds: details.heteroStudentIds || [],
    existingRatings: (details.existingRatings || []).map((rating) => ({
      evaluatedId: rating.avaluat_id,
      behaviorId: rating.codi_comportament,
      value: Number(rating.value)
    }))
  };
}

function mapPublicCycle(data) {
  return {
    nom_cicle: data.name,
    classe: data.classGroup,
    data_inici: data.startsOn || '',
    data_final: data.endsOn || '',
    descripcio: data.notes || ''
  };
}

function mapPublicSession(data) {
  return {
    cicle_id: data.cycleId,
    nom_sessio: data.name,
    data_sessio: data.sessionDate || '',
    openNow: Boolean(data.openNow),
    behaviors: data.behaviorCodes || [],
    heteroStudents: data.studentIds || []
  };
}

function mapPublicRatings(ratings) {
  return ratings.map((rating) => ({
    avaluat_id: rating.evaluatedId || rating.avaluat_id,
    codi_comportament: rating.behaviorId || rating.codi_comportament,
    value: rating.value
  }));
}

function syncPublicRosterToSupabase() {
  return withScriptLock(() => {
    const spreadsheet = ensureDatabase({ syncRosters: true });
    return syncRostersToSupabaseIfConfigured(spreadsheet, false);
  });
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
