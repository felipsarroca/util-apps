/* Lectura genèrica dels formularis: l'estructura del formulari és l'estructura de l'informe.
   Secció → bloc amb títol; pregunta de valoració → obre un bloc; preguntes obertes → s'hi afegeixen.
   «[tutor]» al títol d'una pregunta o secció l'exclou del PDF. */
const QUESTION_TYPES = ['TEXT', 'PARAGRAPH_TEXT', 'MULTIPLE_CHOICE', 'LIST', 'CHECKBOXES', 'SCALE', 'RATING',
  'GRID', 'CHECKBOX_GRID', 'DATE', 'TIME', 'DATETIME', 'DURATION'];

function questionType_(item) { return String(item.getType()); }
function isQuestion_(item) { return QUESTION_TYPES.includes(questionType_(item)); }
function isTutorOnly_(title) { return /\[\s*tutor\s*\]/i.test(String(title || '')); }
function cleanTitle_(title) { return String(title || '').replace(/\[\s*tutor\s*\]/ig, '').replace(/\s+/g, ' ').trim(); }
function isIdentity_(title, type) { return type === 'TEXT' && /\b(nom|cognoms?)\b/.test(normalize_(title)); }

function choicesOf_(item) {
  const type = questionType_(item);
  if (type === 'MULTIPLE_CHOICE') return item.asMultipleChoiceItem().getChoices().map(c => c.getValue());
  if (type === 'LIST') return item.asListItem().getChoices().map(c => c.getValue());
  if (type === 'CHECKBOXES') return item.asCheckboxItem().getChoices().map(c => c.getValue());
  return null;
}
function gridRows_(item) {
  const type = questionType_(item);
  if (type === 'GRID') return item.asGridItem().getRows();
  if (type === 'CHECKBOX_GRID') return item.asCheckboxGridItem().getRows();
  return null;
}
function scaleOf_(item, choices) {
  const type = questionType_(item);
  if (type === 'SCALE') {
    const s = item.asScaleItem();
    return {min: Number(s.getLowerBound()), max: Number(s.getUpperBound())};
  }
  if (type === 'RATING') {
    try { return {min: 1, max: Number(item.asRatingItem().getRatingScaleLevel())}; }
    catch (e) { return {min: 1, max: 0}; }
  }
  if ((type === 'MULTIPLE_CHOICE' || type === 'LIST') && choices.length && choices.every(c => levelOf_(c))) {
    return {min: 1, max: 4};
  }
  return null;
}

function formStructure_(form) {
  const sections = [{title: '', tutorOnly: false, blocks: []}];
  let identityId = '';
  form.getItems().forEach(item => {
    const type = questionType_(item), title = String(item.getTitle() || '').trim();
    if (type === 'PAGE_BREAK' || type === 'SECTION_HEADER') {
      sections.push({title: cleanTitle_(title), tutorOnly: isTutorOnly_(title), blocks: []});
      return;
    }
    if (!isQuestion_(item)) return;
    if (!identityId && isIdentity_(title, type)) { identityId = String(item.getId()); return; }
    const section = sections[sections.length - 1];
    if (section.tutorOnly || isTutorOnly_(title)) return;
    const choices = choicesOf_(item);
    const q = {id: String(item.getId()), title: cleanTitle_(title), help: String(item.getHelpText() || '').trim(),
      type, choices, rows: gridRows_(item), scale: scaleOf_(item, choices || [])};
    const last = section.blocks[section.blocks.length - 1];
    if (q.scale) section.blocks.push({title: q.title, level: q, questions: []});
    else if (last) last.questions.push(q);
    else section.blocks.push({title: '', level: null, questions: [q]});
  });
  return {identityId, sections: sections.filter(s => s.blocks.length)};
}

/* Resum llegible de l'estructura, per mostrar-lo al professorat abans d'obrir el formulari. */
function structureSummary_(structure) {
  let levels = 0, open = 0;
  structure.sections.forEach(s => s.blocks.forEach(b => { if (b.level) levels++; open += b.questions.length; }));
  return {sections: structure.sections.filter(s => s.title).length, levels, open, identity: !!structure.identityId};
}

function campaignFolder_(year, course, label) {
  let rootId = config_('ROOT_FOLDER_ID');
  if (!rootId) {
    const root = DriveApp.createFolder('La veu de l’alumnat · fitxers privats');
    rootId = root.getId(); setConfig_('ROOT_FOLDER_ID', rootId);
  }
  return DriveApp.getFolderById(rootId).createFolder(year + ' · ' + course + ' · ' + label);
}

/* L'app treballa amb el compte propietari: el professorat del curs ha de poder obrir la carpeta (PDF, respostes)
   i editar el formulari. Només s'afegeixen els comptes actius que encara no hi tenen accés. */
function campaignPeople_(course) {
  return [...new Set(rows_('access').filter(r => r[3] === 'SI' && (r[1] === course || r[1] === '*'))
    .map(r => mailKey_(r[0])).filter(Boolean))];
}
function shareCampaign_(campaign) {
  const people = campaignPeople_(campaign[1]);
  if (!people.length) return;
  const have = list => new Set(list.map(u => mailKey_(u.getEmail())));
  if (campaign[6]) {
    try {
      const folder = DriveApp.getFolderById(String(campaign[6]));
      const done = have(folder.getEditors().concat(folder.getViewers()));
      done.add(mailKey_(folder.getOwner().getEmail()));
      const missing = people.filter(e => !done.has(e));
      if (missing.length) folder.addViewers(missing);
    } catch (e) { /* la carpeta ja no existeix o el compte no la pot compartir */ }
  }
  if (campaign[4] && origin_(campaign) !== 'HISTORICA') {
    try {
      const file = DriveApp.getFileById(String(campaign[4]));
      const done = have(file.getEditors());
      done.add(mailKey_(file.getOwner().getEmail()));
      const missing = people.filter(e => !done.has(e));
      if (missing.length) file.addEditors(missing);
    } catch (e) { /* formulari d'un altre propietari */ }
  }
}
function ensureCampaignFolder_(campaign) {
  if (!campaign[6]) {
    campaign[6] = campaignFolder_(campaign[2], campaign[1], campaign[3]).getId();
    if (!campaign[8]) campaign[8] = 'HISTORICA'; // sense carpeta pròpia: és una recollida importada
    replaceRows_('campaigns', rows_('campaigns').map(r => r[0] === campaign[0] ? campaign : r));
  }
  shareCampaign_(campaign);
  return DriveApp.getFolderById(String(campaign[6]));
}
/* Quan s'afegeix professorat, se li obren les recollides que ja existeixen del seu curs. */
function shareCourseCampaigns_(course) {
  rows_('campaigns').filter(r => course === '*' || r[1] === course).forEach(shareCampaign_);
}

function openFormForEdit_(formId) {
  try { return FormApp.openById(formId); }
  catch (e) { throw new Error('El compte del centre no pot editar aquest formulari. Afegeix-lo com a col·laborador i torna-ho a provar.'); }
}

/* Configuració que permet identificar l'alumnat pel correu escolar: una resposta per compte. */
function configureForm_(form) {
  try { form.setRequireLogin(true); } catch (e) { /* només disponible en formularis de Workspace */ }
  form.setCollectEmail(true).setLimitOneResponsePerUser(true).setAllowResponseEdits(false)
    .setPublishingSummary(false).setShowLinkToRespondAgain(false);
  if (form.supportsAdvancedResponderPermissions()) form.setPublished(false);
  else form.setAcceptingResponses(false);
}

function sourceFormId_(course, sourceUrl) {
  if (String(sourceUrl || '').trim()) return idFromUrl_(sourceUrl);
  const previous = rows_('campaigns').filter(r => r[1] === course && r[4])
    .sort((a, b) => String(b[7]).localeCompare(String(a[7])))[0];
  if (previous) return String(previous[4]);
  const template = rows_('templates').find(r => r[0] === course);
  if (template) return String(template[1]);
  throw new Error('És la primera recollida de ' + course + ': enganxa l’enllaç d’edició del formulari de partida.');
}

function createCampaign(course, year, label, sourceUrl, mode) {
  const me = requireAccess_(course, ['admin', 'cap_estudis', 'tutor']);
  if (!VA.COURSES.includes(course) || !/^20\d\d-20\d\d$/.test(year)
      || typeof label !== 'string' || !label.trim() || label.length > 80 || /[\r\n\x00-\x1f]/.test(label)) {
    throw new Error('Cal indicar curs, curs escolar (p. ex. 2026-2027) i nom de la recollida.');
  }
  if (!['copia', 'directe'].includes(mode)) throw new Error('Tria si vols fer una còpia o fer servir el formulari tal com és.');
  if (mode === 'directe' && !String(sourceUrl || '').trim()) throw new Error('Enganxa l’enllaç del formulari que vols fer servir.');
  label = label.trim();
  const sourceId = sourceFormId_(course, sourceUrl);
  if (mode === 'directe' && rows_('campaigns').some(r => String(r[4]) === sourceId)) {
    throw new Error('Aquest formulari ja correspon a una altra recollida. Tria «Fes-ne una còpia nova».');
  }
  const source = openFormForEdit_(sourceId);
  const folder = campaignFolder_(year, course, label);
  const title = 'La veu de l’alumnat · ' + course + ' · ' + label + ' · ' + year;
  let form = source;
  if (mode === 'copia') {
    const file = DriveApp.getFileById(sourceId).makeCopy(title, folder);
    form = FormApp.openById(file.getId());
    const oldItems = source.getItems(), newItems = form.getItems();
    if (oldItems.length !== newItems.length || oldItems.some((x, i) => questionType_(x) !== questionType_(newItems[i])
        || x.getTitle() !== newItems[i].getTitle())) {
      throw new Error('La còpia del formulari no conserva totes les preguntes. S’ha deixat sense publicar a la carpeta de la recollida.');
    }
    if (form.getResponses().length) throw new Error('La còpia conté respostes; no es pot usar com a formulari nou.');
    /* La còpia és del compte propietari de l'app: qui crea la recollida l'ha de poder editar. */
    try { form.addEditor(me); } catch (e) { /* ja n'és propietari */ }
  }
  const responses = form.getResponses().length;
  let status = 'ESBORRANY';
  if (responses) status = form.isAcceptingResponses() ? 'OBERTA' : 'TANCADA';
  else configureForm_(form);
  let hasDestination = true;
  try { form.getDestinationId(); } catch (e) { hasDestination = false; }
  if (!hasDestination) {
    const sheet = SpreadsheetApp.create(title + ' · respostes');
    DriveApp.getFileById(sheet.getId()).moveTo(folder);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  }
  const id = uuid_();
  const row = [id, course, year, label, form.getId(), status, folder.getId(), now_(), mode === 'copia' ? 'COPIA' : 'DIRECTE'];
  putRows_('campaigns', [row]);
  shareCampaign_(row);
  const structure = formStructure_(form);
  return {id, status, responses, collectsEmail: form.collectsEmail(), summary: structureSummary_(structure)};
}

function setCampaignOpen(id, open) {
  if (typeof open !== 'boolean') throw new Error('Estat del formulari no vàlid.');
  const all = rows_('campaigns'), i = all.findIndex(r => r[0] === id);
  if (i < 0) throw new Error('Recollida desconeguda.');
  const row = all[i]; requireAccess_(row[1], ['admin', 'cap_estudis', 'tutor']);
  if (origin_(row) === 'HISTORICA') throw new Error('El formulari històric no s’obre ni es modifica des d’aquesta aplicació.');
  if (!['ESBORRANY', 'OBERTA', 'TANCADA'].includes(row[5])) throw new Error('La recollida ja està aprovada; no es pot tornar a obrir.');
  const form = FormApp.openById(String(row[4]));
  if (form.supportsAdvancedResponderPermissions()) form.setPublished(Boolean(open));
  else form.setAcceptingResponses(Boolean(open));
  row[5] = open ? 'OBERTA' : 'TANCADA';
  replaceRows_('campaigns', all);
  return {status: row[5], responseUrl: form.getPublishedUrl()};
}
