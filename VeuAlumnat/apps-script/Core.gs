/* La veu de l'alumnat · projecte independent, sense dades personals al codi. */
const VA = Object.freeze({
  COURSES: ['1r.ESO', '2n.ESO', '3r.ESO', '4t.ESO'],
  TABS: {
    config: ['clau', 'valor'],
    students: ['id_alumne', 'curs', 'nom_complet', 'correu_escolar', 'actiu'],
    contacts: ['id_alumne', 'curs', 'noms_responsables', 'correu_familiar', 'autoritzat', 'actiu'],
    contactAliases: ['curs', 'nom_alumne_csv', 'id_alumne', 'validat'],
    access: ['correu_professional', 'curs', 'rol', 'actiu'],
    templates: ['curs', 'id_formulari', 'nom'],
    campaigns: ['id', 'curs', 'curs_escolar', 'nom', 'id_formulari', 'estat', 'id_carpeta', 'creada_el', 'origen'],
    reports: ['id_campanya', 'id_alumne', 'id_resposta', 'id_pdf', 'estat', 'generat_el', 'versio', 'token_confirmacio', 'enllac_confirmacio'],
    legacy: ['id_campanya', 'id_resposta', 'nom_escrit', 'id_alumne_proposat', 'validat'],
    deliveries: ['id_campanya', 'id_alumne', 'correu_familiar', 'noms_responsables', 'id_pdf', 'estat', 'enviat_el', 'confirmat_el'],
    issues: ['id_campanya', 'tipus', 'referencia', 'detall', 'resolta']
  }
});

function setupControl() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('CONTROL_ID')) throw new Error('El full de control ja està configurat.');
  const email = Session.getEffectiveUser().getEmail();
  if (!email || !/@ramonpont\.cat$/i.test(email)) {
    throw new Error('Cal executar la instal·lació amb un compte institucional @ramonpont.cat.');
  }
  const ss = SpreadsheetApp.create('La veu de l’alumnat · control privat');
  const first = ss.getSheets()[0];
  first.setName('config');
  Object.keys(VA.TABS).forEach(name => {
    const sh = name === 'config' ? first : ss.insertSheet(name);
    sh.getRange(1, 1, 1, VA.TABS[name].length).setValues([VA.TABS[name]]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, VA.TABS[name].length).setFontWeight('bold').setBackground('#831E12').setFontColor('#ffffff');
    sh.autoResizeColumns(1, VA.TABS[name].length);
  });
  props.setProperties({CONTROL_ID: ss.getId(), OWNER_EMAIL: email, SCHOOL_DOMAIN: 'ramonpont.cat'});
  putRows_('access', [[email, '*', 'admin', 'SI']]);
  setConfig_('SENDING_ENABLED', 'NO');
  setConfig_('CONTACTS_APPROVED', 'NO');
  setConfig_('CONFIRMATION_ENABLED', 'NO');
  return ss.getUrl();
}

/* Afegeix pestanyes o columnes noves al full de control sense tocar les dades existents. */
function ensureSchema_() {
  const ss = control_();
  Object.keys(VA.TABS).forEach(name => {
    const head = VA.TABS[name], sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const range = sh.getRange(1, 1, 1, head.length);
    if (range.getValues()[0].join('|') === head.join('|')) return;
    range.setValues([head]).setFontWeight('bold').setBackground('#831E12').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
}

/* COPIA o DIRECTE: formulari gestionat per l'app; HISTORICA: formulari original que no es modifica. */
function origin_(campaign) {
  return String(campaign[8] || '') || (campaign[6] ? 'COPIA' : 'HISTORICA');
}

function control_() {
  const id = PropertiesService.getScriptProperties().getProperty('CONTROL_ID');
  if (!id) throw new Error('Cal executar setupControl() amb el compte del centre.');
  return SpreadsheetApp.openById(id);
}

function sheet_(name) { return control_().getSheetByName(name); }
function rows_(name) {
  const sh = sheet_(name), n = sh.getLastRow();
  return n < 2 ? [] : sh.getRange(2, 1, n - 1, VA.TABS[name].length).getValues()
    .map(r => r.map(v => typeof v === 'string' && /^'[=+\-@]/.test(v) ? v.slice(1) : v));
}
function safeRows_(rows) { return rows.map(r => r.map(v => typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v)); }
function putRows_(name, rows) {
  if (!rows.length) return;
  const sh = sheet_(name);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, VA.TABS[name].length).setValues(safeRows_(rows));
}
function replaceRows_(name, rows) {
  const sh = sheet_(name), last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, VA.TABS[name].length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, VA.TABS[name].length).setValues(safeRows_(rows));
}
function setConfig_(key, value) {
  const all = rows_('config').filter(r => r[0] !== key);
  all.push([key, String(value)]);
  replaceRows_('config', all);
}
function config_(key) {
  const row = rows_('config').find(r => r[0] === key);
  return row ? String(row[1]) : '';
}
function idFromUrl_(value) {
  const s = String(value || '').trim();
  const m = s.match(/\/d\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return s;
  throw new Error('L’enllaç o identificador de Google no és vàlid.');
}
function normalize_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function nameKey_(s) { return normalize_(s).split(' ').filter(Boolean).sort().join(' '); }
function mailKey_(s) { return String(s || '').trim().toLowerCase(); }
function now_() { return Utilities.formatDate(new Date(), 'Europe/Madrid', "yyyy-MM-dd'T'HH:mm:ss"); }
function uuid_() { return Utilities.getUuid(); }
function requireAccess_(course, roles) {
  const email = mailKey_(Session.getActiveUser().getEmail());
  if (!email || !email.endsWith('@' + PropertiesService.getScriptProperties().getProperty('SCHOOL_DOMAIN'))) {
    throw new Error('Accés restringit als comptes institucionals del centre.');
  }
  const entry = rows_('access').find(r => mailKey_(r[0]) === email && String(r[3]).toUpperCase() === 'SI'
    && (r[1] === '*' || r[1] === course) && roles.includes(r[2]));
  if (!entry) throw new Error('Aquest compte no té accés a aquest curs o operació.');
  return email;
}
/* tutor: un curs. admin: tots els cursos i la preparació del centre (cap d'estudis, coordinació). */
function addTutor(email, course, role) {
  requireAccess_('*', ['admin']);
  if (role === 'admin') course = '*';
  if (!(VA.COURSES.includes(course) || course === '*') || !['tutor', 'cap_estudis', 'admin'].includes(role)) {
    throw new Error('Curs o rol incorrecte.');
  }
  const e = mailKey_(email);
  if (!e.endsWith('@ramonpont.cat')) throw new Error('Cal un correu institucional.');
  const data = rows_('access').filter(r => !(mailKey_(r[0]) === e && r[1] === course));
  data.push([e, course, role, 'SI']);
  replaceRows_('access', data);
  shareCourseCampaigns_(course);
  return accessList_();
}
function accessList_() {
  return rows_('access').filter(r => r[3] === 'SI').map(r => ({email: String(r[0]), course: String(r[1]), role: String(r[2])}));
}
/* Cada curs canvien els tutors: es treu l'accés sense tocar cap altra dada. */
function removeAccess(email, course) {
  const me = requireAccess_('*', ['admin']), e = mailKey_(email);
  if (e === me && course === '*') throw new Error('No et pots treure a tu mateix l’accés d’administració.');
  replaceRows_('access', rows_('access').filter(r => !(mailKey_(r[0]) === e && String(r[1]) === String(course))));
  return accessList_();
}
