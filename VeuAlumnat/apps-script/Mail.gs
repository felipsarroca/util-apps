function mailContent_(studentName, campaign, withConfirmation) {
  const intro = 'Us fem arribar l’autoavaluació que ' + studentName + ' ha fet en el marc de ' + campaign[3] + '.';
  const purpose = 'Amb aquesta activitat volem donar veu a l’alumnat i ajudar-lo a valorar el seu propi aprenentatge.';
  const detail = 'Al document hi trobareu la valoració que fa del seu aprenentatge i els compromisos de millora que s’ha proposat.';
  const distinction = 'És una reflexió personal de l’alumne/a i no substitueix l’informe d’avaluació del centre.';
  const confirmation = withConfirmation
    ? 'Al final del document trobareu un enllaç per confirmar que heu llegit l’autoavaluació.' : '';
  const paragraphs = ['Benvolguda família,', intro, purpose, detail, distinction,
    'Us animem a comentar-la amb el vostre fill o filla.', confirmation,
    'Si teniu cap dubte, podeu respondre aquest missatge.', 'Atentament,', 'Escola Ramon Pont'].filter(Boolean);
  return paragraphs.join('\n\n');
}
function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function mailMessage_(studentName, campaign, pdf) {
  const body = mailContent_(studentName, campaign, config_('CONFIRMATION_ENABLED') === 'SI' && !!config_('CONFIRMATION_URL'));
  const options = {attachments: [pdf.getBlob()], name: 'Escola Ramon Pont',
    htmlBody: body.split('\n\n').map(p => '<p>' + escapeHtml_(p) + '</p>').join('')};
  if (config_('REPLY_TO')) options.replyTo = config_('REPLY_TO');
  return {subject: 'La meva autoavaluació · ' + campaign[3] + ' · ' + studentName, body, options};
}

/* Envia el primer informe de la recollida només al compte de qui prova, per veure el correu real. */
function sendTestMail(id) {
  const campaign = campaign_(id);
  const me = requireAccess_(campaign[1], ['admin', 'cap_estudis', 'tutor']);
  const report = [...latestReports_(id).values()][0];
  if (!report) throw new Error('Primer cal generar els PDF.');
  const student = rows_('students').find(r => String(r[0]) === String(report[1]));
  const mail = mailMessage_(student ? student[2] : 'Alumne/a', campaign, DriveApp.getFileById(String(report[3])));
  MailApp.sendEmail(me, '[PROVA] ' + mail.subject, mail.body, mail.options);
  return me;
}

function setSendingEnabled(enabled) {
  requireAccess_('*', ['admin']);
  if (typeof enabled !== 'boolean') throw new Error('Valor no vàlid.');
  setConfig_('SENDING_ENABLED', enabled ? 'SI' : 'NO');
  return enabled;
}

function prepareDeliveries(id) {
  const campaign = campaign_(id);
  requireAccess_(campaign[1], ['admin', 'cap_estudis', 'tutor']);
  if (campaign[5] !== 'TANCADA') throw new Error('Cal tancar la recollida abans de preparar destinataris; una remesa aprovada no es pot reconstruir.');
  if (config_('CONTACTS_APPROVED') !== 'SI') throw new Error('Cal validar el directori familiar abans de preparar enviaments.');
  const students = new Map(rows_('students').map(r => [String(r[0]), r]));
  const latestReports = new Map();
  rows_('reports').filter(r => r[0] === id && r[4] === 'GENERAT').forEach(r => latestReports.set(String(r[1]), r));
  const current = rows_('deliveries').filter(r => r[0] === id);
  if (current.some(r => ['ENVIAT', 'EN_CURS', 'CONFIRMAT'].includes(r[5]))) {
    throw new Error('Ja hi ha enviaments iniciats. No es poden reconstruir els destinataris.');
  }
  const next = [], missing = [];
  latestReports.forEach((report, studentId) => {
    const recipients = rows_('contacts').filter(c => String(c[0]) === studentId && c[4] === 'SI' && c[5] === 'SI');
    if (!recipients.length) missing.push(students.get(studentId)?.[2] || studentId);
    recipients.forEach(c => next.push([id, studentId, c[3], c[2], report[3], 'PREPARAT', '', '']));
  });
  replaceRows_('deliveries', rows_('deliveries').filter(r => r[0] !== id).concat(next));
  return {reports: latestReports.size, recipients: next.length, studentsWithoutRecipient: missing};
}

function previewMail(id, studentId) {
  const campaign = campaign_(id);
  requireAccess_(campaign[1], ['admin', 'cap_estudis', 'tutor']);
  const student = rows_('students').find(r => String(r[0]) === String(studentId) && r[1] === campaign[1]);
  if (!student) throw new Error('Alumne desconegut.');
  return {subject: 'La meva autoavaluació · ' + campaign[3] + ' · ' + student[2],
    body: mailContent_(student[2], campaign, config_('CONFIRMATION_ENABLED') === 'SI' && !!config_('CONFIRMATION_URL'))};
}

function approveCampaign(id) {
  const campaign = campaign_(id);
  requireAccess_(campaign[1], ['admin', 'cap_estudis']);
  if (campaign[5] !== 'TANCADA') throw new Error('Cal tancar la recollida.');
  const audit = collectCampaign_(id);
  if (audit.issues.length) throw new Error('Queden incidències de respostes.');
  const reports = rows_('reports').filter(r => r[0] === id && r[4] === 'GENERAT');
  const withLink = config_('CONFIRMATION_ENABLED') === 'SI' ? 'SI' : 'NO';
  if (audit.entries.some(e => !reports.some(r => String(r[1]) === String(e.student[0])
      && String(r[2]) === e.responseId && r[8] === withLink))) {
    throw new Error('No hi ha un PDF actual per cada resposta vàlida.');
  }
  const deliveries = rows_('deliveries').filter(r => r[0] === id);
  if (!deliveries.length) throw new Error('Cal preparar i revisar els destinataris.');
  if (deliveries.some(d => !reports.some(r => String(r[1]) === String(d[1]) && r[3] === d[4]
      && r[8] === withLink))) throw new Error('Els destinataris no apunten a la versió actual del PDF. Torna a preparar-los.');
  campaign[5] = 'APROVADA';
  replaceRows_('campaigns', rows_('campaigns').map(r => r[0] === id ? campaign : r));
  return {reports: audit.entries.length, recipients: deliveries.length};
}

function sendCampaignBatch(id, limit) {
  const campaign = campaign_(id);
  requireAccess_(campaign[1], ['admin', 'cap_estudis']);
  if (config_('SENDING_ENABLED') !== 'SI') throw new Error('L’enviament està desactivat a la configuració.');
  if (campaign[5] !== 'APROVADA') throw new Error('Cal aprovar la remesa abans d’enviar-la.');
  if (config_('CONTACTS_APPROVED') !== 'SI') throw new Error('El directori familiar ja no està validat.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Ja hi ha un enviament en curs.');
  try {
    const students = new Map(rows_('students').map(r => [String(r[0]), r]));
    const all = rows_('deliveries');
    const max = Math.min(Math.max(Number(limit) || 10, 1), 20);
    const pending = all.map((r, i) => ({r, i})).filter(x => x.r[0] === id && x.r[5] === 'PREPARAT').slice(0, max);
    if (MailApp.getRemainingDailyQuota() < pending.length) throw new Error('Quota diària insuficient per a aquest lot.');
    let sent = 0;
    pending.forEach(({r, i}) => {
      const student = students.get(String(r[1]));
      if (!student) throw new Error('Destinatari sense alumne al cens.');
      const pdf = DriveApp.getFileById(String(r[4]));
      r[5] = 'EN_CURS';
      sheet_('deliveries').getRange(i + 2, 6).setValue('EN_CURS');
      SpreadsheetApp.flush();
      const mail = mailMessage_(student[2], campaign, pdf);
      MailApp.sendEmail(String(r[2]), mail.subject, mail.body, mail.options);
      sheet_('deliveries').getRange(i + 2, 6, 1, 2).setValues([['ENVIAT', now_()]]);
      sent++;
    });
    return {sent, remaining: rows_('deliveries').filter(r => r[0] === id && r[5] === 'PREPARAT').length};
  } finally { lock.releaseLock(); }
}

function confirmRead(token, email) {
  if (config_('CONFIRMATION_ENABLED') !== 'SI') throw new Error('La confirmació encara no està activada.');
  if (typeof token !== 'string' || !/^[a-f0-9-]{72}$/i.test(token)
      || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('La confirmació no és vàlida.');
  }
  const cache = CacheService.getScriptCache(), key = 'confirm:' + token;
  const attempts = Number(cache.get(key) || 0);
  if (attempts >= 20) throw new Error('S’ha arribat al límit d’intents. Proveu-ho més tard.');
  cache.put(key, String(attempts + 1), 3600);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Torna-ho a provar d’aquí a un moment.');
  try {
    const report = rows_('reports').find(r => r[7] === String(token) && r[4] === 'GENERAT');
    if (!report) throw new Error('La confirmació no és vàlida.');
    const all = rows_('deliveries');
    const i = all.findIndex(r => r[0] === report[0] && String(r[1]) === String(report[1])
      && mailKey_(r[2]) === mailKey_(email) && ['ENVIAT', 'CONFIRMAT'].includes(r[5]));
    if (i < 0) throw new Error('La confirmació no és vàlida. Reviseu l’adreça escrita.');
    if (all[i][5] === 'CONFIRMAT') return 'Aquesta lectura ja constava com a confirmada. Gràcies.';
    all[i][5] = 'CONFIRMAT'; all[i][7] = now_();
    replaceRows_('deliveries', all);
    return 'Gràcies. Hem registrat la teva confirmació de lectura.';
  } finally { lock.releaseLock(); }
}
