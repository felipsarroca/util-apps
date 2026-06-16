function normalizeEmail_(value) {
  return String(value || "").trim().toLowerCase();
}

function activeUserEmail_() {
  return normalizeEmail_(Session.getActiveUser().getEmail());
}

function effectiveUserEmail_() {
  return normalizeEmail_(Session.getEffectiveUser().getEmail());
}

function verifyAccessPasscode(payload) {
  try {
    const user = lookupUser_(APP_CONFIG.allowedRoles);
    const passcode = String(payload && payload.passcode ? payload.passcode : "");
    if (passcode !== APP_CONFIG.accessPasscode) {
      throw new Error("La clau de pas no és correcta.");
    }
    CacheService
      .getUserCache()
      .put(accessCacheKey_(user.email), "1", APP_CONFIG.accessCacheSeconds);
    return { ok: true };
  } catch (error) {
    return publicError_(error);
  }
}

function lookupUser_(roles) {
  const apiUser = typeof apiContextUser_ === "function" ? apiContextUser_() : null;
  if (apiUser) {
    const role = String(apiUser.role || "").toUpperCase();
    if (roles && roles.length && !roles.includes(role)) {
      throw new Error("No tens permisos per fer aquesta operació.");
    }
    return apiUser;
  }
  const email = activeUserEmail_();
  if (!email) {
    throw new Error(
      "No s'ha pogut verificar la identitat del compte. Accedeix amb el compte autoritzat."
    );
  }
  const users = readTable_("Usuaris");
  const user = users.find(
    (item) => normalizeEmail_(item.Email) === email && toBoolean_(item.Actiu)
  );
  if (!user) {
    throw new Error("Aquest compte no està autoritzat per utilitzar l'aplicació.");
  }
  const role = String(user.Rol || "").toUpperCase();
  if (roles && roles.length && !roles.includes(role)) {
    throw new Error("No tens permisos per fer aquesta operació.");
  }
  return { email: email, name: String(user.Nom || ""), role: role };
}

function requireUser_(roles) {
  const user = lookupUser_(roles);
  return user;
}

function requireWebAccess_(user) {
  requireAccessPasscode_(user.email);
  return user;
}

function requireAccessPasscode_(email) {
  if (typeof apiContextUser_ === "function" && apiContextUser_()) return;
  const cacheValue = CacheService.getUserCache().get(accessCacheKey_(email));
  if (cacheValue !== "1") {
    throw new Error("Cal introduir la clau de pas per obrir l'aplicació.");
  }
}

function accessCacheKey_(email) {
  return `access:${Utilities.base64EncodeWebSafe(String(email || "anonymous")).slice(0, 80)}`;
}

function validateId_(value, fieldName) {
  const text = String(value || "");
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/i.test(text)) {
    throw new Error(`El camp ${fieldName} no és vàlid.`);
  }
  return text;
}

function validateHours_(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0 || hours > 60) {
    throw new Error("Les hores han de ser un nombre entre 0 i 60.");
  }
  return Math.round(hours * 100) / 100;
}

function safeText_(value, maxLength) {
  let text = String(value == null ? "" : value).trim();
  if (text.length > maxLength) {
    throw new Error(`El text no pot superar els ${maxLength} caràcters.`);
  }
  if (/^[=+\-@]/.test(text)) {
    text = "'" + text;
  }
  return text;
}

function safeJsonForAudit_(value) {
  const text = JSON.stringify(value == null ? null : value);
  return text.length > 45000 ? text.slice(0, 45000) + "…" : text;
}

function publicError_(error) {
  console.error(error && error.stack ? error.stack : error);
  const message = error && error.message ? error.message : "S'ha produït un error.";
  return { ok: false, error: message };
}
