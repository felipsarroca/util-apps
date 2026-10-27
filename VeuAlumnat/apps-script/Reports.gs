const LEVELS = {'1': ['NA', 'No assoliment'], '2': ['AS', 'Assoliment satisfactori'],
  '3': ['AN', 'Assoliment notable'], '4': ['AE', 'Assoliment excel·lent']};
const LEVEL_ALIASES = {'no assolit': '1', 'assolit': '2'};
/* Etiqueta d'una pregunta oberta que repeteix el títol del bloc (p. ex. «Català» + «Català»). */
const DEFAULT_LABEL = 'Compromís de millora';

function levelOf_(value) {
  const s = normalize_(value);
  let m = s.match(/^([1-4])\b/);
  if (m) return m[1];
  m = s.match(/^(na|as|an|ae)\b/);
  if (m) return {na: '1', as: '2', an: '3', ae: '4'}[m[1]];
  return Object.keys(LEVELS).find(k => normalize_(LEVELS[k][1]) === s) || LEVEL_ALIASES[s] || '';
}

function levelView_(q, raw) {
  const value = String(raw == null ? '' : raw).trim();
  if (!value) return null;
  const code = q.scale.min === 1 && q.scale.max === 4 ? levelOf_(value) : '';
  if (code) return {code, abbr: LEVELS[code][0], name: LEVELS[code][1]};
  return {text: q.scale.max && /^\d+$/.test(value) ? value + ' de ' + q.scale.max : value};
}

function answerView_(q, raw) {
  if (raw == null) return null;
  if (q.rows && Array.isArray(raw)) {
    const table = q.rows.map((row, i) => [row, Array.isArray(raw[i]) ? raw[i].join(', ') : String(raw[i] == null ? '' : raw[i]).trim()])
      .filter(r => r[1]);
    return table.length ? {table} : null;
  }
  if (Array.isArray(raw)) {
    const list = raw.map(x => String(x).trim()).filter(Boolean);
    return list.length ? {list} : null;
  }
  const text = String(raw).trim();
  return text ? {text} : null;
}

function labelFor_(q, block) {
  if (block.level && normalize_(q.title) === normalize_(block.title)) return q.help || DEFAULT_LABEL;
  return q.title;
}

/* Converteix les respostes d'un alumne en seccions i blocs; tot el que és buit s'omet. */
function reportModel_(structure, answers) {
  return structure.sections.map(s => ({title: s.title, blocks: s.blocks.map(b => {
    const level = b.level ? levelView_(b.level, answers.get(b.level.id)) : null;
    const items = b.questions.map(q => ({label: labelFor_(q, b), value: answerView_(q, answers.get(q.id))}))
      .filter(x => x.value);
    return level || items.length ? {title: b.title, level, items} : null;
  }).filter(Boolean)})).filter(s => s.blocks.length);
}

function usesOfficialScale_(structure) {
  return structure.sections.some(s => s.blocks.some(b => b.level && b.level.scale.min === 1 && b.level.scale.max === 4));
}

function reportMeta_(campaign, studentName, structure, token) {
  const confirmUrl = config_('CONFIRMATION_ENABLED') === 'SI' && config_('CONFIRMATION_URL') && token
    ? config_('CONFIRMATION_URL') + '?mode=confirm&token=' + encodeURIComponent(token) : '';
  return {student: studentName, label: campaign[3], course: campaign[1], year: campaign[2], logo: logoJpeg_(),
    legend: usesOfficialScale_(structure), confirmUrl, title: 'Autoavaluació · ' + studentName + ' · ' + campaign[3],
    generated: Utilities.formatDate(new Date(), 'Europe/Madrid', 'dd/MM/yyyy')};
}

function savePdf_(model, meta, name, folder) {
  return folder.createFile(Utilities.newBlob(buildReportPdf_(model, meta), 'application/pdf', name + '.pdf'));
}

function campaign_(id) {
  const row = rows_('campaigns').find(r => r[0] === id);
  if (!row) throw new Error('Recollida desconeguda.');
  return row;
}

function responseAnswers_(response) {
  const result = new Map();
  response.getItemResponses().forEach(x => result.set(String(x.getItem().getId()), x.getResponse()));
  return result;
}

function legacySuggestion_(name, students) {
  const exact = students.filter(r => nameKey_(r[2]) === nameKey_(name));
  if (exact.length === 1) return exact[0];
  const bits = normalize_(name).split(' ').filter(Boolean);
  if (bits.length < 2) return null;
  const first = bits[0], initial = bits[bits.length - 1][0];
  const possible = students.filter(r => {
    const full = normalize_(r[2]).split(' ');
    return full.includes(first) && full.some(x => x[0] === initial);
  });
  return possible.length === 1 ? possible[0] : null;
}

/* Llegeix totes les respostes, identifica l'alumnat i construeix el model de cada informe.
   Incidències (bloquegen): alumne fora del cens, identitat per validar. Avisos: respostes repetides. */
function collectCampaign_(id) {
  const campaign = campaign_(id);
  requireAccess_(campaign[1], ['admin', 'cap_estudis', 'tutor']);
  const form = FormApp.openById(String(campaign[4]));
  const structure = formStructure_(form);
  const students = rows_('students').filter(r => r[1] === campaign[1] && r[4] === 'SI');
  const byEmail = new Map(students.map(r => [mailKey_(r[3]), r]));
  const byId = new Map(students.map(r => [String(r[0]), r]));
  const legacy = rows_('legacy').filter(r => r[0] === id);
  const byResponse = new Map(legacy.map(r => [String(r[1]), r]));
  const nextLegacy = [...legacy], issues = [], latest = new Map(), repeated = new Set();
  const responses = form.getResponses();
  responses.forEach(response => {
    const responseId = String(response.getId()), answers = responseAnswers_(response);
    const schoolMail = mailKey_(response.getRespondentEmail());
    let student = null;
    if (schoolMail) {
      student = byEmail.get(schoolMail) || null;
      if (!student) issues.push([id, 'alumne_desconegut', responseId, schoolMail, 'NO']);
    } else {
      const raw = structure.identityId ? answers.get(structure.identityId) : '';
      const written = String(raw || '').trim();
      let record = byResponse.get(responseId);
      if (!record) {
        const candidate = legacySuggestion_(written, students);
        record = [id, responseId, written, candidate ? candidate[0] : '', 'PENDENT'];
        nextLegacy.push(record);
      }
      student = record[4] === 'SI' ? byId.get(String(record[3])) || null : null;
      if (!student) issues.push([id, 'identitat_per_validar', responseId, written, 'NO']);
    }
    if (!student) return;
    const key = String(student[0]), time = response.getTimestamp().getTime(), previous = latest.get(key);
    if (previous) repeated.add(key);
    if (!previous || previous.time < time) latest.set(key, {student, responseId, time, answers});
  });
  replaceRows_('legacy', rows_('legacy').filter(r => r[0] !== id).concat(nextLegacy));
  replaceRows_('issues', rows_('issues').filter(r => r[0] !== id).concat(issues));
  const entries = [...latest.values()].sort((a, b) => String(a.student[2]).localeCompare(String(b.student[2])))
    .map(e => ({student: e.student, responseId: e.responseId, model: reportModel_(structure, e.answers)}));
  const missing = students.filter(r => !latest.has(String(r[0])));
  const warnings = [...repeated].map(k => ({type: 'resposta_repetida', detail: byId.get(k)[2]}));
  return {campaign, form, structure, entries, issues, warnings, missing, responseCount: responses.length};
}

function latestReports_(id) {
  const latest = new Map();
  rows_('reports').filter(r => r[0] === id && r[4] === 'GENERAT').forEach(r => latest.set(String(r[1]), r));
  return latest;
}

/* Tot el que la pantalla necessita per mostrar una recollida i decidir quin és el pas següent. */
function campaignOverview(id) {
  const data = collectCampaign_(id), c = data.campaign, form = data.form, origin = origin_(c);
  const reports = latestReports_(id);
  const studentNames = new Map(rows_('students').map(r => [String(r[0]), r[2]]));
  const deliveries = rows_('deliveries').filter(r => r[0] === id);
  const students = rows_('students');
  return {
    id, course: c[1], year: c[2], label: c[3], status: c[5], origin,
    editUrl: origin === 'HISTORICA' ? '' : form.getEditUrl(), responseUrl: form.getPublishedUrl(),
    collectsEmail: form.collectsEmail(), summary: structureSummary_(data.structure),
    responses: data.responseCount, students: data.entries.length + data.missing.length,
    entries: data.entries.map(e => ({studentId: String(e.student[0]), student: e.student[2]})),
    missing: data.missing.map(r => r[2]),
    issues: data.issues.filter(r => r[1] !== 'identitat_per_validar').map(r => ({type: r[1], detail: r[3]})),
    warnings: data.warnings,
    legacyToCheck: rows_('legacy').filter(r => r[0] === id && r[4] !== 'SI')
      .map(r => ({responseId: r[1], writtenName: r[2], suggestedStudentId: r[3],
        suggestedStudentName: (students.find(s => String(s[0]) === String(r[3])) || [, , ''])[2]})),
    reports: [...reports.values()].map(r => ({studentId: String(r[1]), student: studentNames.get(String(r[1])) || r[1],
      pdfUrl: 'https://drive.google.com/file/d/' + r[3] + '/view'})),
    folderUrl: c[6] ? 'https://drive.google.com/drive/folders/' + c[6] : '',
    recipients: deliveries.map(r => ({student: studentNames.get(String(r[1])) || r[1], email: r[2], status: r[5]})),
    contactsApproved: config_('CONTACTS_APPROVED') === 'SI', sendingEnabled: config_('SENDING_ENABLED') === 'SI'
  };
}

function approveLegacyResponse(campaignId, responseId, studentId) {
  const campaign = campaign_(campaignId);
  requireAccess_(campaign[1], ['admin', 'cap_estudis', 'tutor']);
  const students = rows_('students');
  if (!students.some(r => String(r[0]) === String(studentId) && r[1] === campaign[1])) throw new Error('L’alumne no figura al cens del curs.');
  const all = rows_('legacy'), i = all.findIndex(r => r[0] === campaignId && String(r[1]) === String(responseId));
  if (i < 0) throw new Error('Primer cal revisar la recollida.');
  all[i][3] = String(studentId); all[i][4] = 'SI';
  replaceRows_('legacy', all);
  return true;
}

function approveSuggestedLegacyBatch(campaignId) {
  const campaign = campaign_(campaignId);
  requireAccess_(campaign[1], ['admin', 'cap_estudis', 'tutor']);
  if (campaign[5] !== 'TANCADA') throw new Error('La recollida ha d’estar tancada.');
  collectCampaign_(campaignId);
  const all = rows_('legacy');
  const selected = all.filter(r => r[0] === campaignId);
  const pending = selected.filter(r => r[4] !== 'SI');
  if (!pending.length) return {approved: 0, remaining: 0, unresolved: []};
  const validIds = new Set(rows_('students').filter(r => r[1] === campaign[1] && r[4] === 'SI')
    .map(r => String(r[0])));
  const used = new Set(selected.filter(r => r[4] === 'SI').map(r => String(r[3])));
  const candidateCounts = new Map();
  pending.forEach(r => {
    const id = String(r[3]);
    if (String(r[2]).trim() && validIds.has(id) && !used.has(id)) {
      candidateCounts.set(id, (candidateCounts.get(id) || 0) + 1);
    }
  });
  const approvedResponses = new Set(pending.filter(r => candidateCounts.get(String(r[3])) === 1
    && String(r[2]).trim() && validIds.has(String(r[3])) && !used.has(String(r[3])))
    .map(r => String(r[1])));
  replaceRows_('legacy', all.map(r => r[0] === campaignId && approvedResponses.has(String(r[1]))
    ? [r[0], r[1], r[2], r[3], 'SI'] : r));
  const unresolved = pending.filter(r => !approvedResponses.has(String(r[1])))
    .map(r => String(r[2]).trim() || 'Resposta sense nom');
  return {approved: approvedResponses.size, remaining: unresolved.length, unresolved};
}

/* Respostes inventades a partir de l'estructura, per veure l'informe abans que l'alumnat respongui. */
function sampleAnswers_(structure) {
  const answers = new Map();
  const long = 'He treballat amb constància, he revisat els errors i he demanat ajuda quan no entenia un concepte. '.repeat(4);
  let i = 0;
  structure.sections.forEach(s => s.blocks.forEach(b => {
    if (b.level) {
      const q = b.level;
      answers.set(q.id, q.choices ? q.choices[i % q.choices.length]
        : String(q.scale.min + i % Math.max(1, (q.scale.max || 4) - q.scale.min + 1)));
    }
    b.questions.forEach(q => answers.set(q.id, q.rows ? q.rows.map(() => 'Exemple')
      : q.choices ? q.choices.slice(0, 2) : i % 4 === 2 ? long + '\n\n' + long : 'Resposta breu d’exemple.'));
    i++;
  }));
  return answers;
}

/* Crea el PDF real (d'exemple o d'un alumne) a la carpeta de proves i en retorna l'enllaç.
   Només es conserva l'última previsualització. */
function previewReport(id, studentId) {
  const data = collectCampaign_(id), c = data.campaign;
  let model, name;
  if (studentId) {
    const entry = data.entries.find(e => String(e.student[0]) === String(studentId));
    if (!entry) throw new Error('Aquest alumne no té cap resposta identificada.');
    model = entry.model; name = entry.student[2];
  } else {
    model = reportModel_(data.structure, sampleAnswers_(data.structure)); name = 'Alumne/a d’exemple';
  }
  if (!config_('ROOT_FOLDER_ID')) throw new Error('Primer cal carregar el logotip oficial.');
  /* Dins la carpeta de la recollida, perquè el professorat del curs també el pugui obrir. */
  const folder = ensureCampaignFolder_(c), found = folder.getFoldersByName('Previsualitzacions');
  const previews = found.hasNext() ? found.next() : folder.createFolder('Previsualitzacions');
  const previous = config_('PREVIEW_FILE_ID');
  if (previous) { try { DriveApp.getFileById(previous).setTrashed(true); } catch (e) { /* ja no hi és */ } }
  const pdf = savePdf_(model, reportMeta_(c, name, data.structure, ''), 'Previsualització · ' + name + ' · ' + c[3],
    previews);
  setConfig_('PREVIEW_FILE_ID', pdf.getId());
  return {url: pdf.getUrl(), name: pdf.getName()};
}

/* Genera els PDF que falten fins a esgotar uns 4 minuts; la pantalla torna a cridar fins que no en queden.
   Amb regenerate, els PDF anteriors passen a SUBSTITUIT (i a la paperera) i es tornen a fer tots. */
function generateReports(id, regenerate) {
  const data = collectCampaign_(id), campaign = data.campaign, started = Date.now();
  if (config_('CONFIRMATION_ENABLED') === 'SI' && !/^https:\/\//.test(config_('CONFIRMATION_URL'))) {
    throw new Error('Cal configurar l’enllaç de confirmació abans de generar els PDF.');
  }
  if (campaign[5] !== 'TANCADA') throw new Error('Cal tancar el formulari abans de generar els informes.');
  if (data.issues.length) throw new Error('Cal resoldre ' + data.issues.length + ' incidències abans de generar els PDF.');
  const folder = ensureCampaignFolder_(campaign);
  if (regenerate === true) {
    if (rows_('deliveries').some(r => r[0] === id && r[5] !== 'PREPARAT')) {
      throw new Error('Ja s’han enviat informes d’aquesta recollida; no es poden regenerar.');
    }
    const all = rows_('reports');
    all.forEach(r => {
      if (r[0] !== id || r[4] !== 'GENERAT') return;
      r[4] = 'SUBSTITUIT';
      try { DriveApp.getFileById(String(r[3])).setTrashed(true); } catch (e) { /* ja no existeix */ }
    });
    replaceRows_('reports', all);
    replaceRows_('deliveries', rows_('deliveries').filter(r => r[0] !== id));
  }
  const existing = rows_('reports').filter(r => r[0] === id && r[4] === 'GENERAT');
  const confirmationState = config_('CONFIRMATION_ENABLED') === 'SI' ? 'SI' : 'NO';
  const pending = data.entries.filter(entry => !existing.some(r => String(r[1]) === String(entry.student[0])
    && String(r[2]) === entry.responseId && r[8] === confirmationState));
  let created = 0;
  for (const entry of pending) {
    if (Date.now() - started > 270000) break;
    const token = uuid_() + uuid_();
    const pdf = savePdf_(entry.model, reportMeta_(campaign, entry.student[2], data.structure, token),
      'Autoavaluació · ' + entry.student[2] + ' · ' + campaign[3], folder);
    putRows_('reports', [[id, entry.student[0], entry.responseId, pdf.getId(), 'GENERAT', now_(), 1, token, confirmationState]]);
    created++;
  }
  return {created, total: data.entries.length, remaining: pending.length - created, folderUrl: folder.getUrl()};
}

/* Un sol PDF per imprimir a doble cara: tots els informes o només els dels alumnes sense adreça familiar.
   Cada informe porta l'acusament de lectura per retornar-lo signat. Substitueix l'anterior del mateix tipus. */
function generatePrintBundle(id, onlyWithoutEmail) {
  const data = collectCampaign_(id), campaign = data.campaign;
  if (!['TANCADA', 'APROVADA'].includes(campaign[5])) throw new Error('Cal tancar el formulari abans de preparar els informes.');
  if (data.issues.length) throw new Error('Cal resoldre ' + data.issues.length + ' incidències abans de preparar els informes.');
  const withEmail = new Set(rows_('contacts').filter(r => r[5] === 'SI').map(r => String(r[0])));
  const entries = data.entries.filter(e => !onlyWithoutEmail || !withEmail.has(String(e.student[0])));
  if (!entries.length) throw new Error(onlyWithoutEmail ? 'Tots els alumnes amb resposta tenen adreça familiar.' : 'No hi ha informes per imprimir.');
  const folder = ensureCampaignFolder_(campaign);
  const name = 'Per imprimir · ' + campaign[1] + ' · ' + campaign[3] + (onlyWithoutEmail ? ' · sense correu' : ' · tots');
  const old = folder.getFilesByName(name + '.pdf');
  while (old.hasNext()) old.next().setTrashed(true);
  const reports = entries.map(e => ({model: e.model, meta: reportMeta_(campaign, e.student[2], data.structure, '')}));
  const file = folder.createFile(Utilities.newBlob(buildBundlePdf_(reports, name, true), 'application/pdf', name + '.pdf'));
  return {url: file.getUrl(), count: entries.length, students: onlyWithoutEmail ? entries.map(e => e.student[2]) : []};
}
