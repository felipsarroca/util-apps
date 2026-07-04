function syncRostersToSupabaseIfConfigured(spreadsheet, forceSync) {
  const cache = CacheService.getScriptCache();
  const syncKey = 'supabase_roster_sync_v1';
  if (!forceSync && cache.get(syncKey)) return { skipped: true };
  const result = syncRostersToSupabase(spreadsheet);
  cache.put(syncKey, '1', 600);
  return result;
}

function syncRostersToSupabase(spreadsheet) {
  const properties = PropertiesService.getScriptProperties();
  const supabaseUrl = properties.getProperty(APP.supabaseUrlProperty);
  const supabaseAnonKey = properties.getProperty(APP.supabaseAnonKeyProperty);
  const rosterSecret = properties.getProperty(APP.supabaseRosterSecretProperty);
  if (!supabaseUrl || !supabaseAnonKey || !rosterSecret) {
    return { skipped: true, reason: 'Supabase no configurat a Apps Script.' };
  }

  const users = buildSupabaseRosterPayload(spreadsheet || getDatabase());
  const response = UrlFetchApp.fetch(`${supabaseUrl}/rest/v1/rpc/sync_roster_from_sheets`, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`
    },
    payload: JSON.stringify({
      p_secret: rosterSecret,
      p_users: users
    })
  });

  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(`Error sincronitzant Supabase (${status}): ${body}`);
  }
  const result = JSON.parse(body || '{}');
  return {
    synced: Number(result.synced || 0),
    users: users.length
  };
}

function buildSupabaseRosterPayload(spreadsheet) {
  const students = readSheetRows(spreadsheet, SHEETS.students)
    .filter((student) => String(student.actiu).toUpperCase() !== 'FALSE')
    .map((student) => ({
      id: student.alumne_id,
      email: student.email || '',
      firstName: student.nom || '',
      lastName: student.cognoms || '',
      name: student.nom_complet || [student.nom, student.cognoms].filter(Boolean).join(' '),
      role: 'student',
      classGroup: student.classe || '',
      active: true
    }));

  const teachers = readSheetRows(spreadsheet, SHEETS.teachers)
    .filter((teacher) => String(teacher.actiu).toUpperCase() !== 'FALSE')
    .map((teacher) => ({
      id: teacher.professor_id,
      email: teacher.email || '',
      firstName: teacher.nom || '',
      lastName: teacher.cognoms || '',
      name: teacher.nom_complet || [teacher.nom, teacher.cognoms].filter(Boolean).join(' '),
      role: teacher.rol === 'professor' ? 'teacher' : (teacher.rol || 'teacher'),
      classGroup: '',
      active: true
    }));

  return students.concat(teachers).filter((user) => user.id);
}
