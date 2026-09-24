import { COURSES, TYPES, loadSheet, sheetId } from "./data.js";

const root = document.querySelector("#app");
const changeButton = document.querySelector("#change-sheet");
const number = new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 1 });
const emptyFilters = () => ({ course: "", type: "", student: "" });
function savedFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem("dashboardFilters") || "{}");
    return Object.fromEntries(
      Object.keys(emptyFilters()).map((key) => [
        key,
        typeof saved[key] === "string" ? saved[key] : "",
      ]),
    );
  } catch {
    return emptyFilters();
  }
}
const state = {
  url: localStorage.getItem("googleSheetUrl") || "",
  result: null,
  filters: savedFilters(),
  view: "students",
};
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const sum = (rows) => rows.reduce((total, row) => total + row.quantity, 0);
const saveFilters = () =>
  localStorage.setItem("dashboardFilters", JSON.stringify(state.filters));

function showSetup(error = "") {
  changeButton.hidden = true;
  root.innerHTML = `<section class="setup card"><div class="eyebrow">Configuració del full</div><h2>Analitza les incidències del centre</h2><p>Enganxa l'enllaç normal de Google Sheets. L'aplicació llegirà sempre la pestanya <strong>Buidat</strong>.</p>${error ? `<p class="alert error" role="alert">${escapeHtml(error)}</p>` : ""}<form id="sheet-form"><label for="sheet-url">Enllaç del full de càlcul</label><div class="form-row"><input id="sheet-url" type="url" required placeholder="https://docs.google.com/spreadsheets/d/…/edit" value="${escapeHtml(state.url)}"><button class="button button-primary" type="submit">Carrega les dades</button></div></form><p class="hint">El full ha de permetre l'accés de lectura a qualsevol persona amb l'enllaç. Les dades es processen al navegador; només s'hi desa l'enllaç.</p></section>`;
  root.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    openSheet(root.querySelector("input").value.trim());
  });
}

async function openSheet(url) {
  state.url = url;
  if (!sheetId(url)) {
    showSetup("Enganxa un enllaç vàlid de Google Sheets.");
    return;
  }
  changeButton.hidden = false;
  root.innerHTML =
    '<div class="loading" role="status">Carregant la pestanya «Buidat»…</div>';
  try {
    state.result = await loadSheet(url);
    localStorage.setItem("googleSheetUrl", url);
    if (!state.result.data.length)
      throw new Error(
        "No hi ha files vàlides a «Buidat». Revisa Alumne, Curs i Tipus.",
      );
    renderDashboard();
  } catch (error) {
    root.innerHTML = `<section class="error-panel card" role="alert"><h2>Ha sorgit un problema</h2><p>${escapeHtml(error.message)}</p><div class="actions"><button id="retry" class="button button-primary">Torna a intentar-ho</button><button id="edit-url" class="button button-light">Revisa l'enllaç</button></div></section>`;
    root
      .querySelector("#retry")
      .addEventListener("click", () => openSheet(url));
    root
      .querySelector("#edit-url")
      .addEventListener("click", () => showSetup());
  }
}

function options(values, current, placeholder) {
  return `<option value="">${placeholder}</option>${values.map((value) => `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}`;
}

function grouped(rows) {
  const students = new Map();
  for (const row of rows) {
    const key = `${row.course}\u0000${row.student}`;
    if (!students.has(key))
      students.set(key, {
        student: row.student,
        course: row.course,
        byType: Object.fromEntries(TYPES.map((type) => [type, 0])),
        total: 0,
      });
    const entry = students.get(key);
    entry.byType[row.type] += row.quantity;
    entry.total += row.quantity;
  }
  return [...students.values()].sort(
    (a, b) => b.total - a.total || a.student.localeCompare(b.student, "ca"),
  );
}

function barList(
  entries,
  max,
  emptyText = "No hi ha dades amb aquests filtres.",
) {
  if (!entries.length) return `<p class="empty">${emptyText}</p>`;
  return `<div class="bars">${entries.map(([label, value]) => `<div class="bar-row"><span title="${escapeHtml(label)}">${escapeHtml(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${max ? Math.max(2, (value / max) * 100) : 0}%"></div></div><strong>${number.format(value)}</strong></div>`).join("")}</div>`;
}

function warningMarkup(result) {
  const warnings = [];
  if (result.unknown.length)
    warnings.push(
      `Tipus no reconeguts: ${result.unknown.map(([name, count]) => `${escapeHtml(name)} (${count})`).join(", ")}. Aquestes files s'han exclòs.`,
    );
  if (result.invalidRows)
    warnings.push(
      `${result.invalidRows} files amb alumne o curs no vàlid s'han exclòs.`,
    );
  if (result.missingQuantity)
    warnings.push(
      `${result.missingQuantity} files sense quantitat numèrica s'han comptat com a 1.`,
    );
  return warnings.length
    ? `<aside class="alert warning"><strong>Dades per revisar</strong><ul>${warnings.map((text) => `<li>${text}</li>`).join("")}</ul></aside>`
    : "";
}

function csvCell(value) {
  const text = String(value);
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
}
function downloadCsv(rows) {
  const header = ["Alumne", "Curs", ...TYPES, "Total"];
  const csv =
    "\uFEFF" +
    [
      header,
      ...rows.map((row) => [
        row.student,
        row.course,
        ...TYPES.map((type) => row.byType[type]),
        row.total,
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  link.download = "incidencies-filtrades.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function renderDashboard() {
  const { data } = state.result;
  const f = state.filters;
  const rows = data.filter(
    (row) =>
      (!f.course || row.course === f.course) &&
      (!f.type || row.type === f.type) &&
      (!f.student || row.student === f.student),
  );
  const students = grouped(rows);
  const total = sum(rows),
    affected = students.length;
  const byType = TYPES.map((type) => [
    type,
    sum(rows.filter((row) => row.type === type)),
  ]);
  const byCourse = COURSES.map((course) => [
    course,
    sum(rows.filter((row) => row.course === course)),
  ]);
  const topTypes = [...byType]
    .sort((a, b) => b[1] - a[1])
    .filter(([, value]) => value)
    .slice(0, 3);
  const uniqueStudents = [
    ...new Set(
      data
        .filter((row) => !f.course || row.course === f.course)
        .map((row) => row.student),
    ),
  ].sort((a, b) => a.localeCompare(b, "ca"));
  const chips = [
    ["course", "Curs"],
    ["type", "Tipus"],
    ["student", "Alumne"],
  ].filter(([key]) => f[key]);
  const chipsHtml = chips
    .map(
      ([key, label]) =>
        `<button class="chip" data-clear="${key}" title="Elimina aquest filtre">${label}: ${escapeHtml(f[key])} ×</button>`,
    )
    .join("");
  const kpi = (label, value) =>
    `<div class="kpi card"><span>${label}</span><strong>${value}</strong></div>`;
  const topTypeText = topTypes.length
    ? topTypes
        .map(([name, value]) => `${escapeHtml(name)}: ${number.format(value)}`)
        .join(" · ")
    : "Sense dades";
  const typeCards = byType
    .map(
      ([type, value]) =>
        `<div><span>${escapeHtml(type)}</span><strong>${number.format(value)}</strong></div>`,
    )
    .join("");
  const ranking = students.slice(0, 10).map((row) => [row.student, row.total]);

  root.innerHTML = `
    <div class="dashboard">
      <div class="heading">
        <div><div class="eyebrow">Visió general</div><h2>Incidències del centre</h2>
          <p>${data.length} registres vàlids carregats de la pestanya «Buidat».</p></div>
        <button id="reload" class="button button-light">Actualitza les dades</button>
      </div>
      ${warningMarkup(state.result)}
      <section class="card filter-card" aria-label="Filtres">
        <div class="section-title"><h3>Filtres</h3><button id="clear-filters" class="text-button">Neteja filtres</button></div>
        <div class="filters">
          <label>Curs<select data-filter="course">${options(COURSES, f.course, "Tots els cursos")}</select></label>
          <label>Tipus<select data-filter="type">${options(TYPES, f.type, "Tots els tipus")}</select></label>
          <label>Alumne<select data-filter="student">${options(uniqueStudents, f.student, "Tots els alumnes")}</select></label>
        </div>
        ${chipsHtml ? `<div class="chips">${chipsHtml}</div>` : ""}
      </section>
      <section class="kpis" aria-label="Indicadors">
        ${kpi("Total d'incidències", number.format(total))}
        ${kpi("Alumnes afectats", number.format(affected))}
        ${kpi("Mitjana per alumne", affected ? number.format(total / affected) : "0")}
        <div class="kpi card"><span>Tipus principals</span><small>${topTypeText}</small></div>
      </section>
      <section class="card"><h3>Incidències per tipus</h3><div class="type-cards">${typeCards}</div></section>
      <div class="chart-grid">
        <section class="card"><h3>Distribució per tipus</h3>${barList(byType, Math.max(...byType.map((item) => item[1])))}</section>
        <section class="card"><h3>Comparativa per curs</h3>${barList(byCourse, Math.max(...byCourse.map((item) => item[1])))}</section>
      </div>
      <section class="card"><h3>Alumnes amb més incidències</h3>${barList(ranking, students[0]?.total ?? 0)}</section>
      <section class="card">
        <div class="section-title"><h3>Detall de les dades</h3><button id="export" class="button button-primary" ${students.length ? "" : "disabled"}>Exporta CSV</button></div>
        <div class="tabs">
          <button data-view="students" class="tab ${state.view === "students" ? "active" : ""}">Per alumne</button>
          <button data-view="records" class="tab ${state.view === "records" ? "active" : ""}">Incidències</button>
        </div>
        ${state.view === "students" ? studentsTable(students) : recordsTable(rows)}
      </section>
    </div>`;
  root
    .querySelector("#reload")
    .addEventListener("click", () => openSheet(state.url));
  root.querySelector("#clear-filters").addEventListener("click", () => {
    state.filters = emptyFilters();
    saveFilters();
    renderDashboard();
  });
  root.querySelectorAll("[data-filter]").forEach((select) =>
    select.addEventListener("change", () => {
      state.filters[select.dataset.filter] = select.value;
      if (select.dataset.filter === "course") state.filters.student = "";
      saveFilters();
      renderDashboard();
    }),
  );
  root.querySelectorAll("[data-clear]").forEach((button) =>
    button.addEventListener("click", () => {
      state.filters[button.dataset.clear] = "";
      saveFilters();
      renderDashboard();
    }),
  );
  root.querySelectorAll("[data-view]").forEach((button) =>
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      renderDashboard();
    }),
  );
  root
    .querySelector("#export")
    .addEventListener("click", () => downloadCsv(students));
}

function studentsTable(students) {
  return `<div class="table-wrap"><table><thead><tr><th>Alumne</th><th>Curs</th>${TYPES.map((type) => `<th>${escapeHtml(type)}</th>`).join("")}<th>Total</th></tr></thead><tbody>${students.map((row) => `<tr><td>${escapeHtml(row.student)}</td><td>${row.course}</td>${TYPES.map((type) => `<td>${number.format(row.byType[type])}</td>`).join("")}<td><strong>${number.format(row.total)}</strong></td></tr>`).join("") || `<tr><td colspan="10">No hi ha dades amb aquests filtres.</td></tr>`}</tbody></table></div>`;
}

function recordsTable(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>Alumne</th><th>Curs</th><th>Tipus</th><th>Quantitat</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.student)}</td><td>${row.course}</td><td>${escapeHtml(row.type)}</td><td>${number.format(row.quantity)}</td></tr>`).join("") || `<tr><td colspan="4">No hi ha dades amb aquests filtres.</td></tr>`}</tbody></table></div>`;
}

changeButton.addEventListener("click", () => {
  state.result = null;
  state.filters = emptyFilters();
  saveFilters();
  showSetup();
});
if (state.url) openSheet(state.url);
else showSetup();
