function importStudents(sourceUrl) {
  requireAccess_('*', ['admin']);
  const source = SpreadsheetApp.openById(idFromUrl_(sourceUrl));
  const next = [], issues = [], pending = [], seenId = new Set(), seenMail = new Set();
  VA.COURSES.forEach(course => {
    const sh = courseSheet_(source, course);
    if (!sh) throw new Error('Falta la pestanya ' + course + ' al cens.');
    const n = sh.getLastRow(), layout = rosterLayout_(sh);
    const data = n < layout.first ? [] : sh.getRange(layout.first, 1, n - layout.first + 1, layout.width).getDisplayValues();
    data.forEach((r, j) => {
      const i = j + layout.first - 3;
      const id = String(r[layout.id] || '').trim(), name = String(r[layout.name] || '').trim(), email = mailKey_(r[layout.email]);
      if (!id && !name && !email) return;
      if (name && !id && !email) {
        pending.push(['', 'cens_pendent', course + ':' + (i + 3), 'Nom sense ID ni correu escolar; no s’ha importat', 'NO']);
        return;
      }
      if (!id || !name || !email || !email.endsWith('@ramonpont.cat')
          || id.length > 60 || name.length > 150 || email.length > 254 || /[\r\n\x00-\x1f]/.test(name)) {
        issues.push(['', 'cens_incomplet', course + ':' + (i + 3), 'Falten ID, nom o correu escolar vàlid', 'NO']);
        return;
      }
      if (seenId.has(id) || seenMail.has(email)) {
        issues.push(['', 'cens_duplicat', course + ':' + (i + 3), 'ID o correu escolar duplicat', 'NO']);
        return;
      }
      seenId.add(id); seenMail.add(email);
      next.push([id, course, name, email, 'SI']);
    });
  });
  if (issues.length) {
    replaceRows_('issues', rows_('issues').filter(r => !String(r[1]).startsWith('cens_')).concat(issues, pending));
    throw new Error('El cens té ' + issues.length + ' incidències. No s’ha substituït el cens anterior.');
  }
  replaceRows_('students', next);
  replaceRows_('issues', rows_('issues').filter(r => !String(r[1]).startsWith('cens_')).concat(pending));
  setConfig_('ROSTER_SOURCE_ID', source.getId());
  setConfig_('CONTACTS_APPROVED', 'NO');
  return {students: next.length, pending: pending.length,
    byCourse: VA.COURSES.map(c => [c, next.filter(r => r[1] === c).length])};
}

/* Pestanya d'un curs: «1r.ESO», «1r ESO», «1ESO», «Primer d'ESO»… */
function courseSheet_(source, course) {
  const exact = source.getSheetByName(course);
  if (exact || !source.getSheets) return exact;
  return source.getSheets().find(sh => courseOf_(sh.getName()) === course) || null;
}
/* Columnes del cens. Busca la capçalera a les tres primeres files; si no la troba, usa el format
   del cens actual (dades des de la fila 3; nom a E, ID a F, correu escolar a H). */
function rosterLayout_(sh) {
  const width = Math.max(8, Math.min(sh.getLastColumn ? sh.getLastColumn() : 8, 40));
  const fixed = {first: 3, width, id: 5, name: 4, email: 7};
  const n = sh.getLastRow();
  if (n < 2) return fixed;
  const all = sh.getRange(1, 1, n, width).getDisplayValues();
  for (let r = 0; r < Math.min(3, all.length); r++) {
    const cols = all[r].map(normalize_);
    const email = cols.findIndex(c => /\b(correu|email|e mail)\b/.test(c));
    const id = cols.findIndex(c => /^(id|id alumne|identificador|idalu|ralc)\b/.test(c));
    /* Millor «Cognoms, Nom» que una columna només amb el nom de pila. */
    let name = cols.findIndex(c => /\bnom\b/.test(c) && /\bcognoms?\b/.test(c));
    if (name < 0 && !cols.some(c => /\bcognoms?\b/.test(c))) name = cols.findIndex(c => /^(nom|nom complet|alumne|alumne a)$/.test(c));
    if (email < 0 || id < 0 || name < 0) continue;
    const mails = all.slice(r + 1).map(row => String(row[email]).trim()).filter(Boolean);
    if (mails.length && mails.filter(m => m.includes('@')).length * 2 >= mails.length) return {first: r + 2, width, id, name, email};
  }
  return fixed;
}

/* «Quart d'ESO», «4t ESO», «4t.ESO», «4ESO», «4rt ESO A»… → «4t.ESO». Sense «ESO», no és cap curs. */
function courseOf_(text) {
  const s = normalize_(text).replace(/(\d)(r|n|t|rt)?eso\b/, '$1 eso');
  if (!/\beso\b/.test(s)) return '';
  const words = {primer: 1, segon: 2, tercer: 3, quart: 4, primero: 1, segundo: 2, tercero: 3, cuarto: 4};
  const m = s.match(/\b([1-4])(?:r|n|t|rt|o|a)?\b/) || s.match(/\b(primer|segon|tercer|quart|primero|segundo|tercero|cuarto)\b/);
  return m ? VA.COURSES[(Number(m[1]) || words[m[1]]) - 1] : '';
}

/* Columnes del CSV de responsables pel nom de la capçalera, amb qualsevol separador habitual. */
function contactsTable_(text) {
  const firstLine = String(text).split(/\r?\n/)[0];
  const sep = [';', '\t', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = Utilities.parseCsv(String(text), sep);
  const head = (rows[0] || []).map(normalize_);
  const find = test => head.findIndex(test);
  const cols = {
    course: find(h => /^(curs|nivell|grup|curs alumne|nivell alumne)$/.test(h)),
    student: find(h => /\balumne\b/.test(h)),
    guardian: find(h => /\b(responsable|tutor|pare|mare|familiar)\b/.test(h) || h === 'nom i cognoms'),
    email: find(h => /\b(correu|email|e mail|mail)\b/.test(h))
  };
  if (Object.keys(cols).some(k => cols[k] < 0)) {
    throw new Error('Al CSV no es troben les columnes de curs, nom de l’alumne, nom del responsable i correu. '
      + 'Comprova que la primera fila és la capçalera.');
  }
  return {rows: rows.slice(1), cols};
}

function importContactsCsv(text) {
  requireAccess_('*', ['admin']);
  if (typeof text !== 'string' || text.length > 2 * 1024 * 1024) throw new Error('El CSV és massa gran o no és text.');
  const table = contactsTable_(text), c = table.cols;
  /* Es conserva unes hores perquè validar una correspondència el pugui tornar a importar sol. */
  try { CacheService.getUserCache().put('contactsCsv', text, 21600); } catch (e) { /* massa gran: caldrà tornar-lo a carregar */ }
  const rows = [null].concat(table.rows.map(r => [r[0], r[c.course], '', r[c.student], r[c.guardian], r[c.email]]
    .map(v => v == null ? '' : v)));
  const students = rows_('students');
  if (!students.length) throw new Error('Primer cal importar el cens d’alumnes.');
  const lookup = new Map();
  students.forEach(r => {
    const key = r[1] + '|' + nameKey_(r[2]);
    lookup.set(key, (lookup.get(key) || []).concat([r]));
  });
  const aliases = new Map(rows_('contactAliases').filter(r => r[3] === 'SI')
    .map(r => [r[0] + '|' + nameKey_(r[1]), String(r[2])]));
  const byId = new Map(students.map(r => [String(r[0]), r]));
  const grouped = new Map(), issues = [], unmatched = new Map();
  rows.slice(1).forEach((r, i) => {
    if (r.every(x => !String(x).trim())) return;
    const course = courseOf_(r[1]);
    const candidates = lookup.get(course + '|' + nameKey_(r[3])) || [];
    const aliasId = aliases.get(course + '|' + nameKey_(r[3]));
    if (aliasId === 'EXCLOS') {
      issues.push(['', 'contacte_exclos', String(i + 2), String(r[1]) + ' · ' + String(r[3]), 'SI']);
      return;
    }
    const alias = byId.get(aliasId);
    const student = alias && alias[1] === course ? alias : (candidates.length === 1 ? candidates[0] : null);
    const email = mailKey_(r[5]), guardian = String(r[4] || '').trim();
    if (guardian.length > 150 || email.length > 254 || String(r[3]).length > 150) {
      issues.push(['', 'contacte_format', String(i + 2), 'Text massa llarg', 'NO']); return;
    }
    if (!student) {
      issues.push(['', 'contacte_sense_alumne', String(i + 2), String(r[1]) + ' · ' + String(r[3]), 'NO']);
      const key = course + '|' + nameKey_(r[3]);
      if (!unmatched.has(key)) unmatched.set(key, {course, writtenName: String(r[3]),
        candidates: suggestStudents_(String(r[3]), students.filter(s => s[1] === course))});
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push(['', email ? 'contacte_correu_invalid' : 'contacte_sense_correu', student[0], guardian, 'NO']);
      return;
    }
    const key = student[0] + '|' + email;
    if (!grouped.has(key)) grouped.set(key, {student, email, names: new Set()});
    grouped.get(key).names.add(guardian);
  });
  const next = [...grouped.values()].map(x => [x.student[0], x.student[1], [...x.names].join(' i '), x.email, 'PENDENT', 'SI']);
  replaceRows_('contacts', next);
  replaceRows_('issues', rows_('issues').filter(r => !String(r[1]).startsWith('contacte_')).concat(issues));
  setConfig_('CONTACTS_APPROVED', 'NO');
  return {originalRows: rows.length - 1, uniqueRecipients: next.length, issues: issues.length,
    unmatched: [...unmatched.values()]};
}

function editDistance_(a, b) {
  const x = nameKey_(a), y = nameKey_(b), prev = Array.from({length: y.length + 1}, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    let diag = prev[0]; prev[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const old = prev[j]; prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (x[i - 1] === y[j - 1] ? 0 : 1));
      diag = old;
    }
  }
  return prev[y.length];
}
function suggestStudents_(name, students) {
  return students.map(r => ({id: String(r[0]), name: String(r[2]), distance: editDistance_(name, r[2])}))
    .sort((a, b) => a.distance - b.distance).slice(0, 3);
}
function approveContactAlias(course, writtenName, studentId) {
  requireAccess_('*', ['admin']);
  const student = rows_('students').find(r => String(r[0]) === String(studentId) && r[1] === course);
  if (!student || !String(writtenName).trim() || String(writtenName).length > 150) throw new Error('Correspondència no vàlida.');
  const all = rows_('contactAliases').filter(r => !(r[0] === course && nameKey_(r[1]) === nameKey_(writtenName)));
  all.push([course, String(writtenName).trim(), String(studentId), 'SI']);
  replaceRows_('contactAliases', all);
  return {student: student[2], reimport: reimportContacts_()};
}
/* Torna a aplicar l'últim CSV carregat, si encara és a la memòria temporal. */
function reimportContacts_() {
  const text = CacheService.getUserCache().get('contactsCsv');
  return text ? importContactsCsv(text) : null;
}
function excludeContactName(course, writtenName) {
  requireAccess_('*', ['admin']);
  if (!VA.COURSES.includes(course) || !String(writtenName).trim() || String(writtenName).length > 150) {
    throw new Error('Nom o curs no vàlid.');
  }
  const all = rows_('contactAliases').filter(r => !(r[0] === course && nameKey_(r[1]) === nameKey_(writtenName)));
  all.push([course, String(writtenName).trim(), 'EXCLOS', 'SI']);
  replaceRows_('contactAliases', all);
  return {reimport: reimportContacts_()};
}

function approveContacts() {
  requireAccess_('*', ['admin']);
  const issues = rows_('issues').filter(r => ['contacte_sense_alumne', 'contacte_format', 'contacte_correu_invalid'].includes(String(r[1]))
    && String(r[4]) !== 'SI');
  if (issues.length) throw new Error('Queden ' + issues.length + ' incidències de contactes per resoldre.');
  const contacts = rows_('contacts');
  if (!contacts.length) throw new Error('No hi ha contactes importats.');
  replaceRows_('contacts', contacts.map(r => [r[0], r[1], r[2], r[3], 'SI', r[5]]));
  setConfig_('CONTACTS_APPROVED', 'SI');
  return contacts.length;
}

function dataSummary(course) {
  requireAccess_(course, ['admin', 'cap_estudis', 'tutor']);
  const students = rows_('students').filter(r => r[1] === course && r[4] === 'SI');
  const contacts = rows_('contacts').filter(r => r[1] === course && r[5] === 'SI');
  const withContacts = new Set(contacts.map(r => String(r[0])));
  return {students: students.length, uniqueAddresses: contacts.length,
    studentsWithoutAddress: students.filter(r => !withContacts.has(String(r[0]))).length,
    contactsApproved: config_('CONTACTS_APPROVED') === 'SI'};
}
