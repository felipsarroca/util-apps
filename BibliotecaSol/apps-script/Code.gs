/**
 * Biblioteca de la Sol · enviament de correus
 *
 * Aplicació web propietat de biblioteca@ramonpont.cat. Les Edge Functions de Supabase
 * (notify-reservation i daily-loan-reminders) hi fan peticions POST i el correu surt
 * des d'aquest compte.
 *
 * Seguretat:
 * - Cada petició ha de portar el testimoni secret GOOGLE_MAIL_WEBHOOK_TOKEN de Supabase.
 *   Aquí només es desa la seva empremta SHA-256, de manera que el codi pot ser públic.
 * - Només s'envien correus a adreces del domini del centre.
 * - L'script només té permís per enviar correu (no pot llegir la safata).
 */

const TOKEN_SHA256 = "92fad22e729f664f0b3caee1792bf7ef1811d8dd93de036f9e8aa1ccaf6b76aa";
const ALLOWED_DOMAIN = "@ramonpont.cat";
const SENDER_NAME = "Biblioteca de la Sol";
const MAX_RECIPIENTS = 10;

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (!isValidToken_(payload.token)) {
      return json_({ ok: false, error: "Testimoni no vàlid" });
    }

    const recipients = String(payload.to || "")
      .split(",")
      .map((address) => address.trim().toLowerCase())
      .filter(Boolean);

    if (!recipients.length || recipients.length > MAX_RECIPIENTS) {
      return json_({ ok: false, error: "Destinataris no vàlids" });
    }
    const outside = recipients.filter((address) => !address.endsWith(ALLOWED_DOMAIN));
    if (outside.length) {
      return json_({ ok: false, error: "Només es pot escriure a adreces " + ALLOWED_DOMAIN });
    }

    const subject = String(payload.subject || "").slice(0, 200);
    if (!subject) {
      return json_({ ok: false, error: "Falta l'assumpte" });
    }

    const options = { name: SENDER_NAME };
    if (payload.html) options.htmlBody = String(payload.html);
    if (payload.replyTo && String(payload.replyTo).toLowerCase().endsWith(ALLOWED_DOMAIN)) {
      options.replyTo = String(payload.replyTo);
    }

    MailApp.sendEmail(recipients.join(","), subject, String(payload.text || subject), options);
    return json_({ ok: true, remainingQuota: MailApp.getRemainingDailyQuota() });
  } catch (error) {
    return json_({ ok: false, error: String((error && error.message) || error) });
  }
}

function doGet() {
  return json_({ ok: true, service: "Biblioteca de la Sol · correu" });
}

/**
 * Executa aquesta funció una vegada des de l'editor per autoritzar l'enviament de correu.
 * Envia un missatge de prova al mateix compte.
 */
function provaEnviament() {
  const me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(me, "Biblioteca de la Sol: prova d'enviament", "Si reps aquest correu, els avisos de la biblioteca ja es poden enviar des d'aquest compte.", { name: SENDER_NAME });
  Logger.log("Correu de prova enviat a " + me + ". Quota restant avui: " + MailApp.getRemainingDailyQuota());
}

function isValidToken_(token) {
  if (!token) return false;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token), Utilities.Charset.UTF_8);
  const hex = digest.map((byte) => ((byte + 256) % 256).toString(16).padStart(2, "0")).join("");
  return hex === TOKEN_SHA256;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
