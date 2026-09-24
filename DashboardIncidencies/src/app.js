import { COURSES, TYPES, loadSheet, sheetId } from "./data.js";

const root = document.querySelector("#app");
const changeButton = document.querySelector("#change-sheet");
const number = new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 1 });
const emptyFilters = () => ({ course: [], type: [], student: [] });
function savedFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem("dashboardFilters") || "{}");
    return Object.fromEntries(
      Object.keys(emptyFilters()).map((key) => [
        key,
        Array.isArray(saved[key])
          ? saved[key].filter((value) => typeof value === "string")
          : typeof saved[key] === "string" && saved[key]
            ? [saved[key]]
            : [],
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

function filterButtons(values, selected, key) {
  return values
    .map(
      (value) =>
        `<button type="button" class="filter-button ${selected.includes(value) ? "active" : ""}" data-toggle="${key}" data-value="${escapeHtml(value)}" aria-pressed="${selected.includes(value)}">${escapeHtml(value)}</button>`,
    )
    .join("");
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
  variant = "blue",
) {
  if (!entries.length) return `<p class="empty">${emptyText}</p>`;
  return `<div class="bars bars-${variant}">${entries.map(([label, value]) => `<div class="bar-row"><span title="${escapeHtml(label)}">${escapeHtml(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${max ? Math.max(2, (value / max) * 100) : 0}%"></div></div><strong>${number.format(value)}</strong></div>`).join("")}</div>`;
}

const chartColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#ec4899",
  "#64748b",
];
function donutChart(entries) {
  const visible = entries.filter(([, value]) => value > 0);
  const total = visible.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return '<p class="empty">No hi ha dades per mostrar.</p>';
  let offset = 0;
  const stops = visible.map(([type, value], index) => {
    const start = offset;
    offset += (value / total) * 100;
    return `${chartColors[TYPES.indexOf(type)] || chartColors[index]} ${start}% ${offset}%`;
  });
  const legend = visible
    .map(
      ([type, value]) =>
        `<li><i style="background:${chartColors[TYPES.indexOf(type)]}"></i><span>${escapeHtml(type)}</span><strong>${number.format(value)} <small>(${Math.round((value / total) * 100)}%)</small></strong></li>`,
    )
    .join("");
  return `<div class="donut-layout"><div class="donut" style="background:conic-gradient(${stops.join(",")})"><div><strong>${number.format(total)}</strong><span>incidències</span></div></div><ul class="donut-legend">${legend}</ul></div>`;
}

function courseChart(entries) {
  const max = Math.max(...entries.map(([, value]) => value), 0);
  if (!max) return '<p class="empty">No hi ha dades per mostrar.</p>';
  const average =
    entries.reduce((total, [, value]) => total + value, 0) / COURSES.length;
  const scale = Math.max(max, average) * 1.2;
  return `<div class="course-chart"><div class="course-plot" style="--average-bottom:${(average / scale) * 100}%"><div class="course-average"><span>Mitjana: ${number.format(average)}</span></div>${entries.map(([course, value]) => `<div class="course-column"><strong>${number.format(value)}</strong><div class="course-bar" style="height:${(value / scale) * 100}%"></div></div>`).join("")}</div><div class="course-labels">${entries.map(([course]) => `<span>${course}</span>`).join("")}</div></div>`;
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
      (!f.course.length || f.course.includes(row.course)) &&
      (!f.type.length || f.type.includes(row.type)) &&
      (!f.student.length || f.student.includes(row.student)),
  );
  const students = grouped(rows);
  const summaryStudents = grouped(
    data.filter(
      (row) =>
        (!f.course.length || f.course.includes(row.course)) &&
        (!f.student.length || f.student.includes(row.student)),
    ),
  );
  const total = sum(rows),
    affected = students.length;
  const byType = TYPES.map((type) => [
    type,
    sum(rows.filter((row) => row.type === type)),
  ]);
  const comparisonRows = f.type.length ? rows : data;
  const byCourse = COURSES.map((course) => [
    course,
    sum(comparisonRows.filter((row) => row.course === course)),
  ]);
  const topTypes = [...byType]
    .sort((a, b) => b[1] - a[1])
    .filter(([, value]) => value)
    .slice(0, 3);
  const uniqueStudents = [...new Set(data.map((row) => row.student))].sort(
    (a, b) => a.localeCompare(b, "ca"),
  );
  const chipsHtml = [
    ["course", "Curs"],
    ["type", "Tipus"],
    ["student", "Alumne"],
  ]
    .flatMap(([key, label]) =>
      f[key].map(
        (value) =>
          `<span class="chip">${label}: ${escapeHtml(value)} <button type="button" data-remove="${key}" data-value="${escapeHtml(value)}" aria-label="Elimina ${label}: ${escapeHtml(value)}">×</button></span>`,
      ),
    )
    .join("");
  const icons = {
    total: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    students:
      '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m18 0v-2a4 4 0 00-3-3.87M9 11a4 4 0 100-8 4 4 0 000 8zm8-7.87a4 4 0 010 7.75"/>',
    average: '<path d="M3 3v18h18M7 16l4-5 3 2 5-7"/>',
    top: '<path d="M8 21h8m-4-4v4M7 3h10v7a5 5 0 01-10 0V3zM7 5H4v3a3 3 0 003 3m10-6h3v3a3 3 0 01-3 3"/>',
  };
  const kpiIcon = (name) =>
    `<span class="kpi-icon ${name}" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg></span>`;
  const kpi = (label, value, icon) =>
    `<div class="kpi card">${kpiIcon(icon)}<div><span>${label}</span><strong>${value}</strong></div></div>`;
  const topTypeText = topTypes.length
    ? topTypes
        .map(([name, value]) => `${escapeHtml(name)}: ${number.format(value)}`)
        .join(" · ")
    : "Sense dades";
  const ranking = students.slice(0, 10).map((row) => [row.student, row.total]);

  root.innerHTML = `
    <div class="dashboard">
      <div class="dashboard-actions"><button id="reload" class="button button-light">Actualitza les dades</button></div>
      ${warningMarkup(state.result)}
      <section class="card filter-card" aria-label="Filtres">
        <div class="filters">
          <div class="filter-group"><span class="filter-label">Curs</span><div class="filter-buttons">${filterButtons(COURSES, f.course, "course")}</div></div>
          <div class="filter-group"><span class="filter-label">Tipus d'incidència</span><div class="filter-buttons">${filterButtons(TYPES, f.type, "type")}</div></div>
          <div class="filter-group"><label class="filter-label" for="student-filter">Alumne</label><select id="student-filter" multiple size="5" aria-label="Alumne">${uniqueStudents.map((student) => `<option value="${escapeHtml(student)}" ${f.student.includes(student) ? "selected" : ""}>${escapeHtml(student)}</option>`).join("")}</select></div>
        </div>
        ${chipsHtml ? `<div class="active-filters"><strong>Filtres actius:</strong><div class="chips">${chipsHtml}</div><button id="clear-filters" class="button button-danger" type="button">Neteja Filtres</button></div>` : ""}
      </section>
      <section class="kpis" aria-label="Indicadors">
        ${kpi("Total incidències", number.format(total), "total")}
        ${kpi("Alumnes afectats", number.format(affected), "students")}
        ${kpi("Mitjana per alumne", affected ? number.format(total / affected) : "0", "average")}
        <div class="kpi kpi-top card">${kpiIcon("top")}<div><span>Top 3 tipus</span><small>${topTypeText}</small></div></div>
      </section>
      <div class="chart-grid">
        <section class="card"><h3>Distribució per tipus</h3>${donutChart(byType)}</section>
        <section class="card"><h3>Comparativa per curs</h3>${courseChart(byCourse)}</section>
      </div>
      <section class="card"><h3>Top 10 alumnes amb més incidències</h3>${barList(ranking, students[0]?.total ?? 0, undefined, "green")}</section>
      <section class="card">
        <div class="section-title"><h3>Resum per alumne</h3><button id="export" class="button button-export" ${summaryStudents.length ? "" : "disabled"}>Exporta a CSV</button></div>
        <div class="tabs">
          <button data-view="students" class="tab ${state.view === "students" ? "active" : ""}">Per alumne</button>
          <button data-view="records" class="tab ${state.view === "records" ? "active" : ""}">Incidències</button>
        </div>
        ${state.view === "students" ? studentsTable(summaryStudents, f.type) : recordsTable(rows)}
      </section>
    </div>`;
  root
    .querySelector("#reload")
    .addEventListener("click", () => openSheet(state.url));
  root.querySelector("#clear-filters")?.addEventListener("click", () => {
    state.filters = emptyFilters();
    saveFilters();
    renderDashboard();
  });
  root.querySelectorAll("[data-toggle]").forEach((button) =>
    button.addEventListener("click", () => {
      const key = button.dataset.toggle;
      const value = button.dataset.value;
      state.filters[key] = state.filters[key].includes(value)
        ? state.filters[key].filter((item) => item !== value)
        : [...state.filters[key], value];
      saveFilters();
      renderDashboard();
    }),
  );
  root.querySelector("#student-filter").addEventListener("change", (event) => {
    state.filters.student = [...event.target.selectedOptions].map(
      (option) => option.value,
    );
    saveFilters();
    renderDashboard();
  });
  root.querySelectorAll("[data-remove]").forEach((button) =>
    button.addEventListener("click", () => {
      const key = button.dataset.remove;
      state.filters[key] = state.filters[key].filter(
        (item) => item !== button.dataset.value,
      );
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
    .addEventListener("click", () => downloadCsv(summaryStudents));
}

function studentsTable(students, selectedTypes) {
  const visibleTotal = (row) =>
    selectedTypes.length
      ? selectedTypes.reduce((sum, type) => sum + row.byType[type], 0)
      : row.total;
  students = [...students].sort(
    (a, b) =>
      visibleTotal(b) - visibleTotal(a) ||
      a.student.localeCompare(b.student, "ca"),
  );
  const max = Math.max(
    0,
    ...students.flatMap((row) => TYPES.map((type) => row.byType[type])),
  );
  const heatClass = (value) =>
    !value || !max
      ? ""
      : `heat-${Math.min(5, Math.max(1, Math.ceil((value / max) * 5)))}`;
  return `<div class="table-wrap"><table><thead><tr><th>Alumne</th><th>Curs</th>${TYPES.map((type) => `<th>${escapeHtml(type)}</th>`).join("")}<th>Total</th></tr></thead><tbody>${students.map((row) => `<tr><td>${escapeHtml(row.student)}</td><td>${row.course}</td>${TYPES.map((type) => `<td class="heat ${heatClass(row.byType[type])}">${number.format(row.byType[type])}</td>`).join("")}<td><strong>${number.format(visibleTotal(row))}</strong></td></tr>`).join("") || `<tr><td colspan="10">No hi ha dades amb aquests filtres.</td></tr>`}</tbody></table></div>`;
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
