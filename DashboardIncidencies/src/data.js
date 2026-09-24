export const TYPES = [
  "Absències",
  "Deures",
  "Retard",
  "Mòbil requisat",
  "Falta de respecte",
  "Expulsat de classe",
  "Full d’incidència",
];
export const COURSES = ["1r ESO", "2n ESO", "3r ESO", "4t ESO"];

export function sheetId(url) {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== "docs.google.com") return null;
    return (
      parsed.pathname.match(
        /^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/,
      )?.[1] ?? null
    );
  } catch {
    return null;
  }
}

export function sheetCsvUrl(url) {
  const id = sheetId(url);
  if (!id) throw new Error("Enganxa un enllaç vàlid de Google Sheets.");
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=Buidat&headers=1`;
}

// CSV amb comes, salts de línia i cometes dins de les cel·les.
export function parseCsv(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("El CSV conté una cel·la sense tancar.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  return rows;
}

const plain = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .trim();
const headerKey = (value) => plain(value).replace(/\s+/g, "");

export function normalizeCourse(value) {
  const v = plain(value).replace(/\s+/g, "");
  const names = ["primer", "segon", "tercer", "quart"];
  for (let i = 0; i < 4; i++)
    if (
      new RegExp(`^${i + 1}(?:r|n|t)?(?:d)?eso`).test(v) ||
      v.includes(names[i])
    )
      return COURSES[i];
  return null;
}

export function normalizeType(value) {
  const v = plain(value);
  if (/absenc|falta.*assistencia/.test(v)) return TYPES[0];
  if (/deure|tasca/.test(v)) return TYPES[1];
  if (/retard/.test(v)) return TYPES[2];
  if (/mobil|telefon/.test(v)) return TYPES[3];
  if (/respecte/.test(v)) return TYPES[4];
  if (/expuls/.test(v)) return TYPES[5];
  if (/full.*incidencia/.test(v)) return TYPES[6];
  return null;
}

export function cleanRows(csv) {
  const rows = parseCsv(csv);
  if (!rows.length) throw new Error("La pestanya «Buidat» és buida.");
  const headerIndex = rows.findIndex((row) =>
    ["alumne", "curs", "tipus", "quantitat"].every((name) =>
      row.some((cell) => headerKey(cell) === name),
    ),
  );
  if (headerIndex < 0)
    throw new Error(
      "No s’han trobat les columnes Alumne, Curs, Tipus i Quantitat a «Buidat».",
    );
  const header = rows[headerIndex].map(headerKey);
  const columns = Object.fromEntries(
    ["alumne", "curs", "tipus", "quantitat"].map((name) => [
      name,
      header.indexOf(name),
    ]),
  );
  const data = [],
    unknown = new Map();
  let missingQuantity = 0,
    invalidRows = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const rawType = (row[columns.tipus] ?? "").trim();
    if (!rawType) continue;
    const type = normalizeType(rawType);
    if (!type) {
      unknown.set(rawType, (unknown.get(rawType) ?? 0) + 1);
      continue;
    }
    const student = (row[columns.alumne] ?? "").trim();
    const course = normalizeCourse(row[columns.curs] ?? "");
    if (!student || !course) {
      invalidRows++;
      continue;
    }
    const rawQuantity = (row[columns.quantitat] ?? "").trim();
    let quantity = Number(rawQuantity.replace(",", "."));
    if (
      !rawQuantity ||
      rawQuantity === "-" ||
      !Number.isFinite(quantity) ||
      quantity < 0
    ) {
      quantity = 1;
      missingQuantity++;
    }
    data.push({ student, course, type, quantity });
  }
  return { data, unknown: [...unknown], missingQuantity, invalidRows };
}

export async function loadSheet(url, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(sheetCsvUrl(url));
  } catch {
    throw new Error(
      "No s’ha pogut connectar amb Google Sheets. Comprova la connexió i que el full sigui accessible públicament.",
    );
  }
  if (!response.ok)
    throw new Error(
      `Google Sheets ha retornat l’error ${response.status}. Comparteix el full amb «Qualsevol persona amb l’enllaç» i torna-ho a provar.`,
    );
  const csv = await response.text();
  if (/^\s*<!doctype html|^\s*<html/i.test(csv))
    throw new Error(
      "Google Sheets ha retornat una pàgina HTML. Comprova que el full es pugui consultar sense iniciar sessió.",
    );
  return cleanRows(csv);
}
