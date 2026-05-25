export function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function uniqueStrings(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function parseCommaValues(text) {
  return uniqueStrings(String(text || "").split(","));
}

export function createId(prefix) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

export function escapeCsv(value) {
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function todayFileSuffix() {
  return new Date().toISOString().slice(0, 10);
}
