import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "app", "src", "Index.html");
const faviconPath = path.join(root, "favicon.png");
const claspPath = path.join(root, ".clasp.json");
const authPath = path.join(os.homedir(), ".clasprc.json");
const port = Number(process.env.PORT || 4173);
const spreadsheetId = JSON.parse(fs.readFileSync(claspPath, "utf8")).parentId;
const quotaProject = process.env.GOOGLE_CLOUD_QUOTA_PROJECT || "fullsdecalculia";

const HEADERS = {
  Configuracio: ["Clau", "Valor"],
  CursosEscolars: ["Id", "Nom", "Estat", "Actiu", "CreatEl"],
  Professorat: ["Id", "Cognom1", "Cognom2", "Nom", "NomComplet", "Actiu"],
  Contractes: ["Id", "CursEscolarId", "ProfessorId", "Hores", "Actiu"],
  Grups: ["Id", "CursEscolarId", "Codi", "Nom", "Etapa", "Ordre", "HoresObjectiu", "Actiu"],
  Materies: ["Id", "Nom", "NomCurt", "Activa"],
  PlaEstudis: ["Id", "CursEscolarId", "GrupId", "MateriaId", "Ordre", "HoresObjectiu", "TipusBase", "Actiu"],
  Assignacions: ["Id", "CursEscolarId", "GrupId", "MateriaId", "ProfessorId", "Tipus", "Hores", "FactorCobertura", "Observacions", "Activa", "ActualitzatEl", "ActualitzatPer"],
  Carrecs: ["Id", "Nom", "Ordre", "Actiu"],
  AssignacionsCarrecs: ["Id", "CursEscolarId", "ProfessorId", "CarrecId", "Hores", "Observacions", "Activa", "ActualitzatEl", "ActualitzatPer"],
  ReglesComput: ["Id", "CursEscolarId", "Etapa", "PercentatgeHdc", "Actiu"],
};
const TYPES = {
  CLASSE: { label: "Classe", coverageFactor: 1 },
  REFORC: { label: "Reforç", coverageFactor: 0 },
  DESDOBLAMENT: { label: "Desdoblament", coverageFactor: 0.5 },
  COMPLEMENTARIA: { label: "Complementària", coverageFactor: 1 },
};

function bool(value) {
  return value === true || value === 1 || String(value).toLowerCase() === "true";
}
function num(value) {
  if (value === null || value === undefined || value === "" || value === "-") return 0;
  const text = String(value).trim().replace(",", ".");
  const percentage = text.endsWith("%");
  const parsed = Number(percentage ? text.slice(0, -1) : text);
  if (!Number.isFinite(parsed)) return 0;
  return percentage ? parsed / 100 : parsed;
}
function uuid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
function columnName(count) {
  let result = "";
  while (count > 0) {
    count -= 1;
    result = String.fromCharCode(65 + (count % 26)) + result;
    count = Math.floor(count / 26);
  }
  return result;
}

async function accessToken() {
  const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
  const [account, token] = Object.entries(auth.tokens || {})[0] || [];
  if (!account || !token?.refresh_token) throw new Error("No hi ha cap sessió de clasp disponible.");
  if (token.access_token && Number(token.expiry_date || 0) > Date.now() + 60_000) return token.access_token;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: token.client_id,
      client_secret: token.client_secret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("No s'ha pogut renovar l'accés a Google Sheets.");
  const refreshed = await response.json();
  token.access_token = refreshed.access_token;
  token.expiry_date = Date.now() + Number(refreshed.expires_in || 3600) * 1000;
  auth.tokens[account] = token;
  fs.writeFileSync(authPath, JSON.stringify(auth, null, 2), "utf8");
  return token.access_token;
}

async function sheetsRequest(url, options = {}) {
  const token = await accessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Goog-User-Project": quotaProject,
      ...(options.headers || {}),
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || "Error de Google Sheets.");
  return body;
}

async function readTables() {
  const names = Object.keys(HEADERS);
  const query = names.map((name) => `ranges=${encodeURIComponent(`${name}!A:Z`)}`).join("&");
  const body = await sheetsRequest(`/values:batchGet?majorDimension=ROWS&${query}`);
  const tables = {};
  names.forEach((name, index) => {
    const values = body.valueRanges?.[index]?.values || [];
    const headers = values[0] || HEADERS[name];
    tables[name] = values.slice(1)
      .filter((row) => row.some((value) => value !== ""))
      .map((row, rowIndex) => ({
        _row: rowIndex + 2,
        ...Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""])),
      }));
  });
  return tables;
}

async function appendRecord(table, record) {
  const values = [HEADERS[table].map((header) => record[header] ?? "")];
  await sheetsRequest(`/values/${encodeURIComponent(`${table}!A:A`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values }),
  });
}

async function updateRecord(table, row, record) {
  const end = columnName(HEADERS[table].length);
  await sheetsRequest(`/values/${encodeURIComponent(`${table}!A${row}:${end}${row}`)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values: [HEADERS[table].map((header) => record[header] ?? "")] }),
  });
}

async function upsert(table, id, record, tables) {
  const current = tables[table].find((item) => String(item.Id) === String(id));
  if (current) await updateRecord(table, current._row, record);
  else await appendRecord(table, record);
}

function buildData(tables) {
  const configuredYearId = String(tables.Configuracio.find((item) => String(item.Clau) === "ACTIVE_ACADEMIC_YEAR_ID")?.Valor || "");
  const activeYear =
    tables.CursosEscolars.find((item) => bool(item.Actiu) && String(item.Id) === configuredYearId) ||
    tables.CursosEscolars.find((item) => bool(item.Actiu) && item.Estat === "ESBORRANY") ||
    tables.CursosEscolars.find((item) => bool(item.Actiu) && item.Estat === "EN_PROCES") ||
    tables.CursosEscolars[0];
  if (!activeYear) throw new Error("No hi ha cap curs escolar actiu.");
  const yearId = String(activeYear.Id);
  return {
    app: { name: "Massa horària", subtitle: "Escola Ramon Pont", version: "local-real" },
    user: { email: "clasp@local", name: "Sessió local", role: "ADMIN" },
    activeYear: { id: yearId, name: String(activeYear.Nom), status: String(activeYear.Estat) },
    academicYears: tables.CursosEscolars.filter((item) => bool(item.Actiu)).map((item) => ({
      id: String(item.Id), name: String(item.Nom), status: String(item.Estat), active: true,
    })),
    teachers: tables.Professorat.filter((item) => bool(item.Actiu)).map((item) => ({
      id: String(item.Id), firstName: String(item.Nom || ""), lastName1: String(item.Cognom1 || ""),
      lastName2: String(item.Cognom2 || ""), name: String(item.NomComplet), active: true,
    })).sort((a, b) => a.name.localeCompare(b.name, "ca")),
    courses: tables.Grups.filter((item) => String(item.CursEscolarId) === yearId && bool(item.Actiu)).map((item) => ({
      id: String(item.Id), code: String(item.Codi), name: String(item.Nom), stage: String(item.Etapa),
      order: num(item.Ordre), targetHours: num(item.HoresObjectiu), active: true,
    })).sort((a, b) => a.order - b.order),
    subjects: Object.fromEntries(tables.Materies.filter((item) => bool(item.Activa)).map((item) => [
      String(item.Id), { id: String(item.Id), name: String(item.Nom), shortName: String(item.NomCurt || item.Nom), active: true },
    ])),
    plans: tables.PlaEstudis.filter((item) => String(item.CursEscolarId) === yearId && bool(item.Actiu)).map((item) => ({
      id: String(item.Id), courseId: String(item.GrupId), subjectId: String(item.MateriaId),
      order: num(item.Ordre), targetHours: num(item.HoresObjectiu), baseType: String(item.TipusBase), active: true,
    })),
    assignments: tables.Assignacions.filter((item) => String(item.CursEscolarId) === yearId && bool(item.Activa)).map((item) => ({
      id: String(item.Id), courseId: String(item.GrupId), subjectId: String(item.MateriaId),
      teacherId: String(item.ProfessorId), type: String(item.Tipus), hours: num(item.Hores),
      coverageFactor: num(item.FactorCobertura), notes: String(item.Observacions || ""),
    })),
    contracts: tables.Contractes.filter((item) => String(item.CursEscolarId) === yearId && bool(item.Actiu)).map((item) => ({
      id: String(item.Id), teacherId: String(item.ProfessorId), hours: num(item.Hores),
    })),
    rules: tables.ReglesComput.filter((item) => String(item.CursEscolarId) === yearId && bool(item.Actiu)).map((item) => ({
      id: String(item.Id), stage: String(item.Etapa), hdcRate: num(item.PercentatgeHdc), active: true,
    })),
    charges: tables.Carrecs.filter((item) => bool(item.Actiu)).map((item) => ({
      id: String(item.Id), name: String(item.Nom), order: num(item.Ordre), active: true,
    })).sort((a, b) => a.order - b.order),
    chargeAssignments: tables.AssignacionsCarrecs.filter((item) => String(item.CursEscolarId) === yearId && bool(item.Activa)).map((item) => ({
      id: String(item.Id), teacherId: String(item.ProfessorId), chargeId: String(item.CarrecId),
      hours: num(item.Hores), active: true,
    })),
    assignmentTypes: TYPES,
  };
}

async function loadData() {
  return buildData(await readTables());
}

async function saveCell(payload) {
  const tables = await readTables();
  const data = buildData(tables);
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const current = tables.Assignacions.filter((item) =>
    String(item.CursEscolarId) === data.activeYear.id &&
    String(item.GrupId) === payload.courseId &&
    String(item.MateriaId) === payload.subjectId &&
    String(item.ProfessorId) === payload.teacherId &&
    bool(item.Activa)
  );
  const byType = Object.fromEntries(current.map((item) => [String(item.Tipus), item]));
  const requested = new Set(entries.map((item) => item.type));
  for (const item of current) {
    if (!requested.has(String(item.Tipus))) {
      await updateRecord("Assignacions", item._row, { ...item, Activa: false, ActualitzatEl: new Date().toISOString(), ActualitzatPer: "local" });
    }
  }
  const saved = [];
  for (const entry of entries) {
    if (!TYPES[entry.type]) throw new Error("Tipus d'assignació no vàlid.");
    const hours = Number(entry.hours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 60) throw new Error("Hores no vàlides.");
    const existing = byType[entry.type];
    const record = {
      Id: existing?.Id || uuid("ass"), CursEscolarId: data.activeYear.id, GrupId: payload.courseId,
      MateriaId: payload.subjectId, ProfessorId: payload.teacherId, Tipus: entry.type, Hores: hours,
      FactorCobertura: TYPES[entry.type].coverageFactor, Observacions: "", Activa: true,
      ActualitzatEl: new Date().toISOString(), ActualitzatPer: "local",
    };
    if (existing) await updateRecord("Assignacions", existing._row, record);
    else await appendRecord("Assignacions", record);
    saved.push({
      id: record.Id, courseId: record.GrupId, subjectId: record.MateriaId, teacherId: record.ProfessorId,
      type: record.Tipus, hours: record.Hores, coverageFactor: record.FactorCobertura, notes: "",
    });
  }
  return { ok: true, assignments: saved };
}

function nextYearName(name) {
  const match = String(name || "").match(/^(\d{4}|\d{2})-(\d{2}|\d{4})$/);
  if (!match) throw new Error("No s'ha pogut calcular el curs següent.");
  const first = Number(match[1]);
  const firstFull = first < 100 ? 2000 + first : first;
  const nextFirst = firstFull + 1;
  return `${nextFirst}-${String((nextFirst + 1) % 100).padStart(2, "0")}`;
}

async function setConfiguration(tables, key, value) {
  const current = tables.Configuracio.find((item) => String(item.Clau) === key);
  if (current) await updateRecord("Configuracio", current._row, { Clau: key, Valor: value });
  else await appendRecord("Configuracio", { Clau: key, Valor: value });
}

async function createNextYear(payload, tables, data) {
  const sourceName = String(payload.sourceName || data.activeYear.name);
  const targetName = String(payload.targetName || nextYearName(sourceName));
  const source = tables.CursosEscolars.find((item) => String(item.Nom) === sourceName);
  if (!source) throw new Error(`No existeix el curs ${sourceName}.`);
  const existingTarget = tables.CursosEscolars.find((item) => String(item.Nom) === targetName);
  if (existingTarget) {
    await setConfiguration(tables, "ACTIVE_ACADEMIC_YEAR_ID", String(existingTarget.Id));
    return { ok: true, created: false, id: String(existingTarget.Id) };
  }
  const sourceYearId = String(source.Id);
  const targetYearId = `curs-${targetName}`;
  const suffix = targetName.replace(/[^0-9a-z]+/gi, "-").toLowerCase();
  const now = new Date().toISOString();
  const groupMap = {};
  for (const group of tables.Grups.filter((item) => String(item.CursEscolarId) === sourceYearId)) {
    const id = `${String(group.Id)}-${suffix}`;
    groupMap[String(group.Id)] = id;
    await appendRecord("Grups", { ...group, Id: id, CursEscolarId: targetYearId });
  }
  for (const plan of tables.PlaEstudis.filter((item) => String(item.CursEscolarId) === sourceYearId)) {
    await appendRecord("PlaEstudis", { ...plan, Id: `${String(plan.Id)}-${suffix}`, CursEscolarId: targetYearId, GrupId: groupMap[String(plan.GrupId)] });
  }
  for (const contract of tables.Contractes.filter((item) => String(item.CursEscolarId) === sourceYearId)) {
    await appendRecord("Contractes", { ...contract, Id: `${String(contract.Id)}-${suffix}`, CursEscolarId: targetYearId });
  }
  for (const rule of tables.ReglesComput.filter((item) => String(item.CursEscolarId) === sourceYearId)) {
    await appendRecord("ReglesComput", { ...rule, Id: `${String(rule.Id)}-${suffix}`, CursEscolarId: targetYearId });
  }
  let index = 1;
  for (const assignment of tables.Assignacions.filter((item) => String(item.CursEscolarId) === sourceYearId)) {
    await appendRecord("Assignacions", {
      ...assignment, Id: `ass-${suffix}-${String(index++).padStart(4, "0")}`, CursEscolarId: targetYearId,
      GrupId: groupMap[String(assignment.GrupId)], ActualitzatEl: now, ActualitzatPer: "local",
    });
  }
  index = 1;
  for (const charge of tables.AssignacionsCarrecs.filter((item) => String(item.CursEscolarId) === sourceYearId)) {
    await appendRecord("AssignacionsCarrecs", {
      ...charge, Id: `ac-${suffix}-${String(index++).padStart(3, "0")}`, CursEscolarId: targetYearId,
      ActualitzatEl: now, ActualitzatPer: "local",
    });
  }
  await appendRecord("CursosEscolars", { Id: targetYearId, Nom: targetName, Estat: "ESBORRANY", Actiu: true, CreatEl: now });
  const sourceRecord = tables.CursosEscolars.find((item) => String(item.Id) === sourceYearId);
  if (sourceRecord) await updateRecord("CursosEscolars", sourceRecord._row, { ...sourceRecord, Estat: "TANCAT", Actiu: true });
  await setConfiguration(tables, "ACTIVE_ACADEMIC_YEAR_ID", targetYearId);
  return { ok: true, created: true, id: targetYearId };
}

async function saveManagement(method, payload) {
  const tables = await readTables();
  const data = buildData(tables);
  const yearId = data.activeYear.id;
  if (method === "saveAcademicYearStatus") {
    const status = String(payload.status || "").toUpperCase();
    if (!["ESBORRANY", "EN_PROCES", "ACTIU", "TANCAT"].includes(status)) throw new Error("L'estat del curs no és vàlid.");
    const year = tables.CursosEscolars.find((item) => String(item.Id) === String(payload.id));
    if (!year) throw new Error("No s'ha trobat el curs escolar.");
    await updateRecord("CursosEscolars", year._row, { ...year, Estat: status, Actiu: true });
    await setConfiguration(tables, "ACTIVE_ACADEMIC_YEAR_ID", String(year.Id));
    return { ok: true, id: String(year.Id), status };
  }
  if (method === "createNextAcademicYear") {
    return createNextYear(payload || {}, tables, data);
  }
  if (method === "saveTeacher") {
    const id = payload.id || uuid("prof");
    await upsert("Professorat", id, {
      Id: id, Cognom1: payload.lastName1, Cognom2: payload.lastName2 || "", Nom: payload.firstName,
      NomComplet: [payload.firstName, payload.lastName1, payload.lastName2].filter(Boolean).join(" "), Actiu: payload.active !== false,
    }, tables);
    const contract = tables.Contractes.find((item) => String(item.CursEscolarId) === yearId && String(item.ProfessorId) === id);
    const contractId = contract?.Id || uuid("con");
    await upsert("Contractes", contractId, {
      Id: contractId, CursEscolarId: yearId, ProfessorId: id,
      Hores: Number(payload.contractHours || 0), Actiu: Number(payload.contractHours || 0) > 0,
    }, tables);
    const requested = new Map((payload.charges || []).filter((item) => Number(item.hours) > 0).map((item) => [item.chargeId, Number(item.hours)]));
    for (const existing of tables.AssignacionsCarrecs.filter((item) => String(item.CursEscolarId) === yearId && String(item.ProfessorId) === id)) {
      await updateRecord("AssignacionsCarrecs", existing._row, {
        ...existing, Hores: requested.get(String(existing.CarrecId)) || 0,
        Activa: requested.has(String(existing.CarrecId)), ActualitzatEl: new Date().toISOString(), ActualitzatPer: "local",
      });
      requested.delete(String(existing.CarrecId));
    }
    for (const [chargeId, hours] of requested) {
      await appendRecord("AssignacionsCarrecs", {
        Id: uuid("ac"), CursEscolarId: yearId, ProfessorId: id, CarrecId: chargeId, Hores: hours,
        Observacions: "", Activa: true, ActualitzatEl: new Date().toISOString(), ActualitzatPer: "local",
      });
    }
    return { ok: true, id };
  }
  const definitions = {
    saveCourse: ["Grups", payload.id || uuid("grup"), {
      Id: payload.id || uuid("grup"), CursEscolarId: yearId, Codi: payload.code, Nom: payload.name,
      Etapa: payload.stage, Ordre: Number(payload.order), HoresObjectiu: Number(payload.targetHours), Actiu: payload.active !== false,
    }],
    saveSubject: ["Materies", payload.id || uuid("mat"), {
      Id: payload.id || uuid("mat"), Nom: payload.name, NomCurt: payload.shortName || payload.name, Activa: payload.active !== false,
    }],
    savePlan: ["PlaEstudis", payload.id || uuid("pla"), {
      Id: payload.id || uuid("pla"), CursEscolarId: yearId, GrupId: payload.courseId, MateriaId: payload.subjectId,
      Ordre: Number(payload.order), HoresObjectiu: Number(payload.targetHours), TipusBase: payload.baseType || "CLASSE", Actiu: payload.active !== false,
    }],
    saveCharge: ["Carrecs", payload.id || uuid("car"), {
      Id: payload.id || uuid("car"), Nom: payload.name, Ordre: Number(payload.order), Actiu: payload.active !== false,
    }],
    saveRule: ["ReglesComput", payload.id || uuid("reg"), {
      Id: payload.id || uuid("reg"), CursEscolarId: yearId, Etapa: payload.stage,
      PercentatgeHdc: Number(payload.hdcRate), Actiu: payload.active !== false,
    }],
  };
  const definition = definitions[method];
  if (!definition) throw new Error("Operació no permesa.");
  const [table, id, record] = definition;
  record.Id = id;
  await upsert(table, id, record, tables);
  return { ok: true, id };
}

function localBridge() {
  return `<script>
    (() => {
      function runner() {
        let success = () => {};
        let failure = () => {};
        const api = new Proxy({
          withSuccessHandler(fn) { success = fn; return api; },
          withFailureHandler(fn) { failure = fn; return api; },
        }, {
          get(target, property) {
            if (property in target) return target[property];
            return (payload) => {
              const route = property === "getApplicationData" ? "/api/data" : "/api/action/" + property;
              fetch(route, {
                method: property === "getApplicationData" ? "GET" : "POST",
                headers: { "Content-Type": "application/json" },
                body: property === "getApplicationData" ? undefined : JSON.stringify(payload || {}),
              }).then((r) => r.json()).then(success).catch(failure);
            };
          },
        });
        return api;
      }
      window.google = { script: {} };
      Object.defineProperty(window.google.script, "run", { get: runner });
    })();
  </script>`;
}

function renderHtml() {
  return fs.readFileSync(htmlPath, "utf8")
    .replaceAll("<?= appName ?>", "Massa horària")
    .replaceAll("<?= appSubtitle ?>", "Escola Ramon Pont")
    .replaceAll("<?= faviconUrl ?>", "/favicon.png")
    .replace("<script>\n      const state", `${localBridge()}\n    <script>\n      const state`);
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}
function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; if (body.length > 200_000) reject(new Error("Petició massa gran.")); });
    request.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch (error) { reject(error); } });
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(renderHtml());
      return;
    }
    if (request.method === "GET" && url.pathname === "/favicon.png") {
      response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
      response.end(fs.readFileSync(faviconPath));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/data") {
      json(response, 200, { ok: true, data: await loadData() });
      return;
    }
    if (request.method === "POST" && url.pathname.startsWith("/api/action/")) {
      const method = url.pathname.split("/").pop();
      const payload = await readBody(request);
      const result = method === "verifyAccessPasscode"
        ? { ok: payload.passcode === "SoL", error: payload.passcode === "SoL" ? "" : "La clau de pas no és correcta." }
        : method === "saveCellAssignments"
          ? await saveCell(payload)
          : await saveManagement(method, payload);
      json(response, 200, result);
      return;
    }
    json(response, 404, { ok: false, error: "Ruta no trobada." });
  } catch (error) {
    json(response, 400, { ok: false, error: error.message || "Error local." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Massa horària connectada a Google Sheets: http://127.0.0.1:${port}`);
});
