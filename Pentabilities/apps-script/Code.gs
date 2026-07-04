function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.appName = APP.name;
  return template
    .evaluate()
    .setTitle(APP.name)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function appBootstrap() {
  ensureDatabase();
  return {
    app: {
      name: APP.name,
      version: APP.version
    },
    needsLogin: true
  };
}

function buildBootstrapForUser(user, token) {
  const database = ensureDatabase();
  return {
    app: {
      name: APP.name,
      version: APP.version
    },
    token,
    user,
    databaseUrl: database.getUrl(),
    rosterSheets: ROSTER_SHEETS.map((sheet) => sheet.sheetName).concat([ROSTER_TEACHERS_SHEET]),
    classes: getClasses(),
    skills: getSkillsWithBehaviors(),
    cycles: user.role === 'alumne' ? [] : getTeacherCyclesForUser(user),
    activeSessions: user.role === 'alumne' ? [] : addProgressToSessions(getTeacherSessionsForUser(user, true))
  };
}

function refreshSession(token) {
  const user = getCurrentUser(token);
  return buildBootstrapForUser(user, token);
}

function appHealthcheck() {
  const spreadsheet = ensureDatabase();
  return {
    ok: true,
    app: APP.name,
    version: APP.version,
    sheets: Object.values(SHEETS),
    spreadsheetUrl: spreadsheet.getUrl()
  };
}

function tidyPentabilitiesSheets() {
  const spreadsheet = ensureDatabase({ forceSetup: true, syncRosters: true, forceSync: true });
  tidyVisibleSheets(spreadsheet);
  return {
    ok: true,
    spreadsheetUrl: spreadsheet.getUrl(),
    visibleSheets: spreadsheet.getSheets()
      .filter((sheet) => !sheet.isSheetHidden())
      .map((sheet) => sheet.getName())
  };
}
