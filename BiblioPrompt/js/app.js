import { deletePrompt, loadData, savePrompt, toggleFavorite } from "./api.js";
import { createId, downloadFile, escapeCsv, normalizeText, parseCommaValues, todayFileSuffix } from "./utils.js";

const state = {
  data: { prompts: [], programs: [], history: [] },
  filters: { query: "", favorites: false, programId: "", category: "", tag: "" },
  loading: true,
  loadError: false
};

const elements = {
  grid: document.querySelector("#prompt-grid"),
  empty: document.querySelector("#empty-state"),
  visibleCount: document.querySelector("#visible-count"),
  totalCount: document.querySelector("#total-count"),
  summary: document.querySelector("#active-filter-summary"),
  search: document.querySelector("#search-input"),
  favorites: document.querySelector("#favorites-only"),
  programFilter: document.querySelector("#program-filter"),
  categoryFilter: document.querySelector("#category-filter"),
  tagFilter: document.querySelector("#tag-filter"),
  filters: document.querySelector("#filters"),
  filterToggle: document.querySelector("#filter-toggle"),
  dialog: document.querySelector("#prompt-dialog"),
  form: document.querySelector("#prompt-form"),
  dialogTitle: document.querySelector("#dialog-title"),
  id: document.querySelector("#prompt-id"),
  title: document.querySelector("#title-input"),
  content: document.querySelector("#content-input"),
  programOptions: document.querySelector("#program-options"),
  categories: document.querySelector("#categories-input"),
  tags: document.querySelector("#tags-input"),
  notes: document.querySelector("#notes-input"),
  favorite: document.querySelector("#favorite-input"),
  formStatus: document.querySelector("#form-status"),
  saveButton: document.querySelector("#save-prompt-button"),
  saveLabel: document.querySelector("#save-prompt-label"),
  viewDialog: document.querySelector("#view-dialog"),
  viewTitle: document.querySelector("#view-title"),
  viewMetadata: document.querySelector("#view-metadata"),
  viewText: document.querySelector("#view-text"),
  copyView: document.querySelector("#copy-view-button"),
  deleteDialog: document.querySelector("#delete-dialog"),
  deleteTitle: document.querySelector("#delete-prompt-title"),
  confirmDelete: document.querySelector("#confirm-delete-button"),
  toast: document.querySelector("#toast")
};

let toastTimer;

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2300);
}

function programById(id) {
  const storedProgram = state.data.programs.find((program) => program.id === id);
  if (storedProgram) return storedProgram;
  if (id) return { name: id, icon: "", color: "#4338ca" };
  return { name: "Sense programa", icon: "", color: "#64748b" };
}

function programIdsFor(prompt) {
  let values = prompt.programIds ?? prompt.programId ?? [];
  if (!Array.isArray(values)) {
    try {
      values = JSON.parse(values);
    } catch (error) {
      values = String(values).split(",");
    }
  }
  return values
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((value) => state.data.programs.find((program) => (
      program.id === value || normalizeText(program.name) === normalizeText(value)
    ))?.id || value);
}

function programsFor(prompt) {
  const programs = programIdsFor(prompt).map(programById);
  return programs.length ? programs : [programById("")];
}

function option(select, value, label) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  select.append(node);
}

function fillProgramOptions(selectedIds) {
  const preservedIds = selectedIds || Array.from(
    elements.programOptions.querySelectorAll("input:checked"),
    (input) => input.value
  );
  const options = state.data.programs.map((program) => {
    const label = document.createElement("label");
    label.className = "program-choice";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "programs";
    input.value = program.id;
    input.checked = preservedIds.includes(program.id);
    const text = document.createElement("span");
    text.textContent = [program.icon, program.name].filter(Boolean).join(" ");
    label.append(input, text);
    return label;
  });
  if (!options.length) {
    const message = document.createElement("p");
    message.className = "program-message";
    message.textContent = state.loading
      ? "Carregant programes..."
      : state.loadError
        ? "No s'han pogut carregar els programes. Pots desar sense assignar-ne cap."
        : "No hi ha programes configurats. Pots desar sense assignar-ne cap.";
    options.push(message);
  }
  elements.programOptions.replaceChildren(...options);
}

function fillSelectors() {
  const categories = [...new Set(state.data.prompts.flatMap((prompt) => prompt.categories))].sort();
  const tags = [...new Set(state.data.prompts.flatMap((prompt) => prompt.tags))].sort();
  const selectedProgram = elements.programFilter.value;
  const selectedCategory = elements.categoryFilter.value;
  const selectedTag = elements.tagFilter.value;

  elements.programFilter.replaceChildren();
  option(elements.programFilter, "", "Tots els programes");
  state.data.programs.forEach((program) => {
    option(elements.programFilter, program.id, `${program.icon} ${program.name}`);
  });
  state.data.prompts
    .flatMap(programIdsFor)
    .filter((id) => !state.data.programs.some((program) => program.id === id))
    .forEach((id) => {
      if (!Array.from(elements.programFilter.options).some((item) => item.value === id)) {
        option(elements.programFilter, id, id);
      }
    });
  fillProgramOptions();

  elements.categoryFilter.replaceChildren();
  option(elements.categoryFilter, "", "Totes les categories");
  categories.forEach((category) => option(elements.categoryFilter, category, category));

  elements.tagFilter.replaceChildren();
  option(elements.tagFilter, "", "Totes les etiquetes");
  tags.forEach((tag) => option(elements.tagFilter, tag, tag));

  elements.programFilter.value = selectedProgram;
  elements.categoryFilter.value = selectedCategory;
  elements.tagFilter.value = selectedTag;
}

function matchingPrompts() {
  const query = normalizeText(state.filters.query);
  return state.data.prompts.filter((prompt) => {
    const programs = programsFor(prompt);
    const searchable = normalizeText([
      prompt.title,
      prompt.content,
      programs.map((program) => program.name).join(" "),
      prompt.categories.join(" "),
      prompt.tags.join(" ")
    ].join(" "));
    return (!query || searchable.includes(query))
      && (!state.filters.favorites || prompt.favorite)
      && (!state.filters.programId || programIdsFor(prompt).includes(state.filters.programId))
      && (!state.filters.category || prompt.categories.includes(state.filters.category))
      && (!state.filters.tag || prompt.tags.includes(state.filters.tag));
  });
}

function chip(text, className) {
  const node = document.createElement("span");
  node.className = className;
  node.textContent = text;
  return node;
}

function icon(name, className = "icon") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", `#icon-${name}`);
  svg.append(use);
  return svg;
}

function createCard(prompt) {
  const programs = programsFor(prompt);
  const program = programs[0];
  const article = document.createElement("article");
  article.className = "prompt-card";
  article.style.setProperty("--program-color", program.color);
  article.dataset.id = prompt.id;
  article.tabIndex = 0;
  article.setAttribute("aria-label", `Mostra el prompt: ${prompt.title}`);

  const accent = document.createElement("div");
  accent.className = "card-accent";
  const body = document.createElement("div");
  body.className = "card-body";

  const top = document.createElement("div");
  top.className = "card-top";
  const programList = document.createElement("div");
  programList.className = "program-list";
  programs.forEach((item) => {
    programList.append(chip([item.icon, item.name].filter(Boolean).join(" "), "program-pill"));
  });
  top.append(programList);
  const favorite = document.createElement("button");
  favorite.type = "button";
  favorite.className = `star-button${prompt.favorite ? " active" : ""}`;
  favorite.dataset.action = "favorite";
  favorite.ariaLabel = prompt.favorite ? "Treu dels favorits" : "Marca com a favorit";
  favorite.append(icon("star", "icon filled-icon"));
  top.append(favorite);

  const title = document.createElement("h3");
  title.textContent = prompt.title;
  const chips = document.createElement("div");
  chips.className = "chips";
  prompt.categories.forEach((value) => chips.append(chip(value, "category")));
  prompt.tags.slice(0, 3).forEach((value) => chips.append(chip(`#${value}`, "tag")));

  const excerpt = document.createElement("p");
  excerpt.className = "excerpt";
  excerpt.textContent = prompt.content;

  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(
    actionButton("Copiar prompt", "copy", "button button-primary copy-button", "", "copy"),
    actionButton("", "edit", "icon-button", "Edita", "pencil"),
    actionButton("", "duplicate", "icon-button", "Duplica", "duplicate"),
    actionButton("", "delete", "icon-button delete-button", "Elimina", "trash")
  );
  body.append(top, title, chips, excerpt, actions);
  article.append(accent, body);
  return article;
}

function actionButton(text, action, className, label, iconName) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.action = action;
  if (iconName) button.append(icon(iconName));
  if (text) button.append(document.createTextNode(text));
  if (label) button.ariaLabel = label;
  return button;
}

function render() {
  const prompts = matchingPrompts();
  elements.grid.replaceChildren(...prompts.map(createCard));
  elements.grid.classList.toggle("hidden", prompts.length === 0);
  elements.empty.classList.toggle("hidden", prompts.length !== 0);
  elements.visibleCount.textContent = String(prompts.length);
  elements.totalCount.textContent = String(state.data.prompts.length);
  const active = [
    state.filters.query && `cerca: "${state.filters.query}"`,
    state.filters.favorites && "favorits",
    state.filters.programId && programById(state.filters.programId).name,
    state.filters.category,
    state.filters.tag
  ].filter(Boolean);
  elements.summary.textContent = active.length ? active.join(" · ") : "Tots els prompts";
}

function openForm(prompt) {
  elements.form.reset();
  elements.formStatus.textContent = "";
  elements.formStatus.classList.remove("error", "visible");
  setFormSaving(false);
  elements.id.value = prompt?.id || "";
  elements.dialogTitle.textContent = prompt ? "Edita el prompt" : "Nou prompt";
  fillProgramOptions(prompt ? programIdsFor(prompt) : []);
  if (prompt) {
    elements.title.value = prompt.title;
    elements.content.value = prompt.content;
    elements.categories.value = prompt.categories.join(", ");
    elements.tags.value = prompt.tags.join(", ");
    elements.notes.value = prompt.notes;
    elements.favorite.checked = prompt.favorite;
  }
  elements.dialog.showModal();
}

function openViewer(prompt) {
  elements.viewTitle.textContent = prompt.title;
  elements.viewText.textContent = prompt.content;
  elements.copyView.dataset.id = prompt.id;
  elements.viewMetadata.replaceChildren(
    ...programsFor(prompt).map((program) => {
      const node = chip([program.icon, program.name].filter(Boolean).join(" "), "program-pill");
      node.style.setProperty("--program-color", program.color);
      return node;
    }),
    ...prompt.categories.map((value) => chip(value, "category")),
    ...prompt.tags.map((value) => chip(`#${value}`, "tag"))
  );
  elements.viewDialog.showModal();
}

function setFormSaving(saving) {
  elements.saveButton.disabled = saving;
  elements.form.setAttribute("aria-busy", String(saving));
  elements.saveLabel.textContent = saving ? "Desant..." : "Desa el prompt";
}

function promptFromForm() {
  const id = elements.id.value || createId("prompt");
  elements.id.value = id;
  return {
    id,
    title: elements.title.value.trim(),
    content: elements.content.value.trim(),
    programIds: Array.from(
      elements.programOptions.querySelectorAll("input:checked"),
      (input) => input.value
    ),
    categories: parseCommaValues(elements.categories.value),
    tags: parseCommaValues(elements.tags.value),
    notes: elements.notes.value.trim(),
    favorite: elements.favorite.checked
  };
}

async function handleCardAction(event) {
  const button = event.target.closest("button[data-action]");
  const card = event.target.closest(".prompt-card");
  if (!card) return;
  const promptId = card.dataset.id;
  const prompt = state.data.prompts.find((item) => item.id === promptId);
  if (!prompt) return;

  if (!button) {
    openViewer(prompt);
    return;
  }
  if (button.dataset.action === "copy") {
    await navigator.clipboard.writeText(prompt.content);
    showToast("Prompt copiat al porta-retalls.");
  }
  if (button.dataset.action === "favorite") {
    state.data = await toggleFavorite(prompt.id, !prompt.favorite);
    render();
  }
  if (button.dataset.action === "edit") openForm(prompt);
  if (button.dataset.action === "duplicate") {
    openForm({ ...prompt, id: "", title: `${prompt.title} (còpia)`, version: 1 });
  }
  if (button.dataset.action === "delete") {
    elements.deleteTitle.textContent = `"${prompt.title}"`;
    elements.confirmDelete.dataset.id = prompt.id;
    elements.deleteDialog.showModal();
  }
}

function exportJson() {
  downloadFile(
    `biblioprompt-copia-${todayFileSuffix()}.json`,
    JSON.stringify(state.data, null, 2),
    "application/json;charset=utf-8"
  );
}

function exportCsv() {
  const headers = ["id", "titol", "prompt", "programes", "categories", "etiquetes", "notes", "favorit", "dataCreacio", "dataModificacio", "versio"];
  const rows = state.data.prompts.map((prompt) => {
    const values = [
      prompt.id, prompt.title, prompt.content, programsFor(prompt).map((program) => program.name),
      prompt.categories, prompt.tags, prompt.notes, prompt.favorite,
      prompt.createdAt, prompt.updatedAt, prompt.version
    ];
    return values.map(escapeCsv).join(";");
  });
  downloadFile(`biblioprompt-prompts-${todayFileSuffix()}.csv`, `\ufeff${headers.join(";")}\n${rows.join("\n")}`, "text/csv;charset=utf-8");
}

function bindEvents() {
  elements.search.addEventListener("input", () => {
    state.filters.query = elements.search.value;
    render();
  });
  elements.favorites.addEventListener("change", () => {
    state.filters.favorites = elements.favorites.checked;
    render();
  });
  elements.programFilter.addEventListener("change", () => {
    state.filters.programId = elements.programFilter.value;
    render();
  });
  elements.categoryFilter.addEventListener("change", () => {
    state.filters.category = elements.categoryFilter.value;
    render();
  });
  elements.tagFilter.addEventListener("change", () => {
    state.filters.tag = elements.tagFilter.value;
    render();
  });
  document.querySelector("#clear-filters-button").addEventListener("click", () => {
    elements.search.value = "";
    elements.favorites.checked = false;
    elements.programFilter.value = "";
    elements.categoryFilter.value = "";
    elements.tagFilter.value = "";
    state.filters = { query: "", favorites: false, programId: "", category: "", tag: "" };
    render();
  });
  elements.filterToggle.addEventListener("click", () => {
    const open = elements.filters.classList.toggle("open");
    elements.filterToggle.setAttribute("aria-expanded", String(open));
  });
  document.querySelector("#new-prompt-button").addEventListener("click", () => openForm());
  document.querySelector("#close-dialog-button").addEventListener("click", () => elements.dialog.close());
  document.querySelector("#cancel-button").addEventListener("click", () => elements.dialog.close());
  document.querySelector("#close-view-button").addEventListener("click", () => elements.viewDialog.close());
  elements.copyView.addEventListener("click", async () => {
    const prompt = state.data.prompts.find((item) => item.id === elements.copyView.dataset.id);
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt.content);
    showToast("Prompt copiat al porta-retalls.");
  });
  document.querySelector("#cancel-delete-button").addEventListener("click", () => elements.deleteDialog.close());
  elements.confirmDelete.addEventListener("click", async () => {
    state.data = await deletePrompt(elements.confirmDelete.dataset.id);
    elements.deleteDialog.close();
    fillSelectors();
    render();
    showToast("Prompt eliminat.");
  });
  elements.grid.addEventListener("click", handleCardAction);
  elements.grid.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches(".prompt-card")) {
      event.preventDefault();
      const prompt = state.data.prompts.find((item) => item.id === event.target.dataset.id);
      if (prompt) openViewer(prompt);
    }
  });
  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (elements.saveButton.disabled) return;
    const isNew = !elements.id.value;
    const prompt = promptFromForm();
    setFormSaving(true);
    elements.formStatus.textContent = "S'està desant el prompt...";
    elements.formStatus.classList.remove("error");
    elements.formStatus.classList.add("visible");
    try {
      state.data = await savePrompt(prompt, isNew);
      elements.formStatus.textContent = "";
      elements.formStatus.classList.remove("visible", "error");
      elements.dialog.close();
      fillSelectors();
      render();
      showToast("Prompt desat correctament.");
    } catch (error) {
      console.error(error);
      elements.formStatus.textContent = "No s'ha pogut desar. Comprova la connexió i torna-ho a provar.";
      elements.formStatus.classList.add("error", "visible");
    } finally {
      setFormSaving(false);
    }
  });
  document.querySelector("#export-json-button").addEventListener("click", exportJson);
  document.querySelector("#export-csv-button").addEventListener("click", exportCsv);
}

async function init() {
  bindEvents();
  fillSelectors();
  render();
  state.data = await loadData();
  state.loading = false;
  fillSelectors();
  setFormSaving(false);
  render();
}

init().catch((error) => {
  console.error(error);
  state.loading = false;
  state.loadError = true;
  fillProgramOptions();
  setFormSaving(false);
  showToast("No s'han pogut carregar les dades. Pots provar de desar un prompt.");
});
