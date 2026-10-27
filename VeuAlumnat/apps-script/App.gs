function doGet(e) {
  if (e && e.parameter && e.parameter.mode === 'confirm') {
    const page = HtmlService.createTemplateFromFile('Confirm');
    page.token = String(e.parameter.token || '');
    return page.evaluate().setTitle('Confirmació de lectura · Escola Ramon Pont');
  }
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('La veu de l’alumnat · Gestió');
}

function bootstrap() {
  const email = mailKey_(Session.getActiveUser().getEmail());
  if (!email || !email.endsWith('@ramonpont.cat')) throw new Error('Cal obrir aquesta aplicació amb el compte institucional del centre.');
  const access = rows_('access').filter(r => mailKey_(r[0]) === email && r[3] === 'SI');
  if (!access.length) throw new Error('Aquest compte encara no està autoritzat.');
  const admin = access.some(r => r[2] === 'admin');
  const courses = admin ? VA.COURSES : [...new Set(access.map(r => r[1]))];
  if (admin) ensureSchema_();
  const campaigns = rows_('campaigns').filter(r => courses.includes(r[1]))
    .sort((a, b) => String(b[7]).localeCompare(String(a[7])))
    .map(r => ({id: r[0], course: r[1], year: r[2], label: r[3], status: r[5]}));
  return {email, admin, courses, campaigns, controlUrl: admin ? control_().getUrl() : '',
    sendingEnabled: config_('SENDING_ENABLED') === 'SI', replyTo: config_('REPLY_TO'), access: admin ? accessList_() : []};
}

function uploadLogo(dataUrl) {
  requireAccess_('*', ['admin']);
  if (typeof dataUrl !== 'string' || dataUrl.length > 3 * 1024 * 1024) throw new Error('El logotip és massa gran.');
  const m = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error('Cal un logotip PNG o JPEG.');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 2 * 1024 * 1024) throw new Error('El logotip supera 2 MB.');
  const folder = config_('ROOT_FOLDER_ID') ? DriveApp.getFolderById(config_('ROOT_FOLDER_ID'))
    : DriveApp.createFolder('La veu de l’alumnat · fitxers privats');
  if (!config_('ROOT_FOLDER_ID')) setConfig_('ROOT_FOLDER_ID', folder.getId());
  const file = folder.createFile(Utilities.newBlob(bytes, m[1], 'logo-escola.' + (m[1] === 'image/png' ? 'png' : 'jpg')));
  setConfig_('LOGO_FILE_ID', file.getId());
  setConfig_('LOGO_PNG_FILE_ID', '');
  return 'Logotip carregat.';
}

function configureReplyTo(email) {
  requireAccess_('*', ['admin']);
  const value = mailKey_(email);
  if (value && !value.endsWith('@ramonpont.cat')) throw new Error('La resposta ha d’anar a un correu del centre.');
  setConfig_('REPLY_TO', value);
  return value;
}

function configureConfirmation(url, enabled) {
  requireAccess_('*', ['admin']);
  if (enabled && !/^https:\/\/script\.google\.com\//.test(String(url || ''))) {
    throw new Error('Cal l’URL del desplegament públic de confirmacions.');
  }
  setConfig_('CONFIRMATION_URL', enabled ? String(url).trim() : '');
  setConfig_('CONFIRMATION_ENABLED', enabled ? 'SI' : 'NO');
  return true;
}
