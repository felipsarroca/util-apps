let API_CONTEXT_USER_ = null;

const API_METHODS_ = Object.freeze({
  getApplicationData: getApplicationData,
  verifyAccessPasscode: verifyAccessPasscode,
  saveCellAssignments: saveCellAssignments,
  saveTeacher: saveTeacher,
  saveCourse: saveCourse,
  saveSubject: saveSubject,
  savePlan: savePlan,
  saveCurriculumPlan: saveCurriculumPlan,
  saveCharge: saveCharge,
  saveRule: saveRule,
  saveAcademicYearStatus: saveAcademicYearStatus,
  createNextAcademicYear: createNextAcademicYear,
});

function handleApiGet_(event) {
  const params = event && event.parameter ? event.parameter : {};
  const callback = validateJsonpCallback_(params.callback);
  const response = executeApiMethod_(params);
  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(response)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function executeApiMethod_(params) {
  try {
    const methodName = String(params.method || "");
    if (!Object.prototype.hasOwnProperty.call(API_METHODS_, methodName)) {
      throw new Error("Mètode no disponible.");
    }
    const payload = parseApiPayload_(params.payload);
    if (methodName === "verifyAccessPasscode") {
      const result = verifyApiAccessPasscode_(payload);
      return result;
    }
    API_CONTEXT_USER_ = requireApiSession_(params.token);
    try {
      return API_METHODS_[methodName](payload);
    } finally {
      API_CONTEXT_USER_ = null;
    }
  } catch (error) {
    API_CONTEXT_USER_ = null;
    return publicError_(error);
  }
}

function verifyApiAccessPasscode_(payload) {
  const passcode = String(payload && payload.passcode ? payload.passcode : "");
  if (passcode !== APP_CONFIG.accessPasscode) {
    throw new Error("La clau de pas no és correcta.");
  }
  const user = externalApiUser_();
  const token = Utilities.getUuid();
  CacheService
    .getScriptCache()
    .put(apiSessionKey_(token), JSON.stringify(user), APP_CONFIG.accessCacheSeconds);
  return { ok: true, token: token, user: user };
}

function requireApiSession_(token) {
  const text = String(token || "");
  if (!/^[a-f0-9-]{20,80}$/i.test(text)) {
    throw new Error("Cal tornar a introduir la clau de pas.");
  }
  const cached = CacheService.getScriptCache().get(apiSessionKey_(text));
  if (!cached) {
    throw new Error("La sessió ha caducat. Torna a introduir la clau de pas.");
  }
  CacheService
    .getScriptCache()
    .put(apiSessionKey_(text), cached, APP_CONFIG.accessCacheSeconds);
  return JSON.parse(cached);
}

function externalApiUser_() {
  const users = readTable_("Usuaris");
  const admin = users.find((item) => String(item.Rol || "").toUpperCase() === "ADMIN" && toBoolean_(item.Actiu));
  if (!admin) {
    throw new Error("No hi ha cap usuari administrador actiu.");
  }
  return {
    email: normalizeEmail_(admin.Email) || "github-pages@massa-horaria.local",
    name: String(admin.Nom || "GitHub Pages"),
    role: "ADMIN",
    source: "GITHUB_PAGES",
  };
}

function apiContextUser_() {
  return API_CONTEXT_USER_;
}

function apiSessionKey_(token) {
  return `api:${Utilities.base64EncodeWebSafe(String(token || "")).slice(0, 90)}`;
}

function parseApiPayload_(payload) {
  if (!payload) return {};
  const text = String(payload);
  if (text.length > 45000) {
    throw new Error("La petició és massa gran.");
  }
  return JSON.parse(text);
}

function validateJsonpCallback_(callback) {
  const text = String(callback || "");
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(text)) {
    throw new Error("Callback no vàlid.");
  }
  return text;
}
