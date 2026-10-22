const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const directory = path.join(root, "data");
const levels = new Set([
  "primaria-inicial",
  "primaria-mitja",
  "primaria-superior",
  "eso",
]);
const ids = new Set();
const themes = [];
for (const name of fs
  .readdirSync(directory)
  .filter((x) => x.endsWith(".json"))
  .sort()) {
  const data = JSON.parse(
    fs.readFileSync(path.join(directory, name), "utf8").replace(/^\uFEFF/, ""),
  );
  if (
    data.schemaVersion !== 1 ||
    typeof data.category !== "string" ||
    !Array.isArray(data.themes)
  )
    throw Error(`Format incorrecte: ${name}`);
  for (const theme of data.themes) {
    if (!/^[a-z0-9-]+$/.test(theme.id) || ids.has(theme.id))
      throw Error(`Identificador incorrecte: ${theme.id}`);
    ids.add(theme.id);
    for (const key of ["title", "description", "instructions"])
      if (typeof theme[key] !== "string" || !theme[key].trim())
        throw Error(`${theme.id}: falta ${key}`);
    if (
      theme.title.length > 70 ||
      !theme.levels.length ||
      !theme.levels.every((x) => levels.has(x))
    )
      throw Error(`${theme.id}: metadades incorrectes`);
    if (
      !Array.isArray(theme.entries) ||
      theme.entries.length < 12 ||
      theme.entries.length > 200
    )
      throw Error(`${theme.id}: quantitat incorrecta`);
    const unique = new Set();
    for (const entry of theme.entries) {
      if (
        typeof entry !== "string" ||
        !entry.trim() ||
        entry !== entry.trim() ||
        entry.length > 80 ||
        /[\r\n]/.test(entry)
      )
        throw Error(
          `${theme.id}: entrada incorrecta (${entry.length}): ${entry}`,
        );
      const normalized = entry.normalize("NFC").toLocaleLowerCase("ca");
      if (unique.has(normalized)) throw Error(`${theme.id}: duplicat ${entry}`);
      unique.add(normalized);
    }
    themes.push({ ...theme, category: data.category });
  }
}
const output =
  "// Generat amb npm run library:build. Editeu els JSON de data/.\nwindow.RULETA_LIBRARY = " +
  JSON.stringify({ schemaVersion: 1, themes }, null, 2) +
  ";\n";
const target = path.join(directory, "library.js");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== output)
    throw Error("Cal regenerar data/library.js amb npm run library:build");
} else fs.writeFileSync(target, output);
console.log(
  `${themes.length} temes, ${themes.reduce((sum, t) => sum + t.entries.length, 0)} opcions; JSON validats.`,
);
