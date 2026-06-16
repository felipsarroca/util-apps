function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Massa horària")
    .addItem("Inicialitza la base de dades", "initializeApplication")
    .addItem("Prepara el curs 2026-27", "prepareAcademicYear2026_27")
    .addSeparator()
    .addItem("Mostra l'enllaç de l'aplicació", "showApplicationLink")
    .addToUi();
}

function doGet() {
  const params = arguments[0] && arguments[0].parameter ? arguments[0].parameter : {};
  if (params.api === "1") {
    return handleApiGet_(arguments[0]);
  }
  const template = HtmlService.createTemplateFromFile("Index");
  template.appName = APP_CONFIG.name;
  template.appSubtitle = APP_CONFIG.subtitle;
  template.faviconUrl = FAVICON_DATA_URL;
  return template
    .evaluate()
    .setTitle(`${APP_CONFIG.name} · ${APP_CONFIG.subtitle}`)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function showApplicationLink() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(
    "Massa horària",
    url
      ? `Aplicació: ${url}`
      : "L'aplicació encara no té cap desplegament web actiu.",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function prepareAcademicYear2026_27() {
  const result = cloneAcademicYear_("2025-26", "2026-27");
  SpreadsheetApp.getUi().alert(
    "Massa horària",
    result.message,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function verifyDatabase() {
  const result = verifyDatabase_();
  console.log(JSON.stringify(result));
  return result;
}
