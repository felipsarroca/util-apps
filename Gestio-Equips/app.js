import {
  ACTION_ICONS,
  ESTATS,
  EVENT_TYPE_LABELS,
  QUICK_ACTIONS,
  initialEsdeveniments,
  initialOrdinadors,
  initialUsuaris,
} from "./data.js";
import { supabase } from "./supabase.js";

const app = document.querySelector("#app");
const AUTH_EMAIL_STORAGE_KEY = "rppo:lastAuthEmail";
const INSTALL_PROMPT_SEEN_STORAGE_KEY = "rppo:installPromptSeen";
let searchRenderTimer = null;
let inventoryRenderTimer = null;
let deferredInstallPromptEvent = null;
const savedAuthEmail = (() => {
  try {
    return localStorage.getItem(AUTH_EMAIL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
})();

const state = {
  accessMode: null,
  authEmail: savedAuthEmail,
  authPassword: "",
  authUser: null,
  accessError: "",
  isAuthenticating: false,
  adminOpen: false,
  adminUsers: [],
  adminMessage: "",
  adminError: "",
  isAdminLoading: false,
  adminForm: {
    email: "",
    password: "",
    role: "consulta",
  },
  installPromptVisible: false,
  peopleOpen: false,
  peopleQuery: "",
  inventoryOpen: false,
  inventoryFilter: "tots",
  inventoryQuery: "",
  inventorySort: "codi",
  query: "",
  selectedResult: null,
  showActionPanel: true,
  currentActionId: null,
  creatorOpen: false,
  editEventId: null,
  editUserId: null,
  editComputerId: null,
  editComputerCode: "",
  mergeTargetId: "",
  formData: {
    data: new Date().toISOString().slice(0, 10),
    usuariId: "",
    descripcio: "",
    opcio: "",
  },
  formError: "",
  createData: {
    kind: "computer",
    codi: "",
    nom: "",
    cognoms: "",
    tipusUsuari: "alumne",
  },
  editEventData: {
    data: "",
    usuariId: "",
    descripcio: "",
  },
  editUserData: {
    nom: "",
    cognoms: "",
    tipusUsuari: "alumne",
    actiu: true,
  },
  users: structuredClone(initialUsuaris),
  computers: structuredClone(initialOrdinadors),
  events: structuredClone(initialEsdeveniments),
  assignments: [],
  source: "local",
  syncMessage: "Carregant dades...",
  isSaving: false,
};

function supabaseErrorMessage(error) {
  const message = error?.message ?? "error desconegut";
  const code = error?.code ? ` (${error.code})` : "";
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) {
    return "Supabase no respon. Pot ser una caiguda de connexió o que el projecte estigui pausat.";
  }
  return `${message}${code}`;
}

const text = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const byDateDesc = (a, b) => new Date(b) - new Date(a);
const formatDate = (value) => new Intl.DateTimeFormat("ca-ES").format(new Date(value));
const makeId = () => crypto.randomUUID();
const isStandaloneMode = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
const isMobileDevice = () =>
  window.matchMedia?.("(max-width: 820px) and (pointer: coarse)")?.matches ||
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const syncInstalledMobileClass = () => {
  document.documentElement.classList.toggle(
    "installed-mobile",
    isStandaloneMode() && isMobileDevice(),
  );
};
const hasSeenInstallPrompt = () => {
  try {
    return localStorage.getItem(INSTALL_PROMPT_SEEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};
const markInstallPromptSeen = () => {
  try {
    localStorage.setItem(INSTALL_PROMPT_SEEN_STORAGE_KEY, "1");
  } catch {}
};
const academicYear = (value) => {
  const d = new Date(value);
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
};
const userRole = (user) =>
  user?.app_metadata?.role ??
  user?.app_metadata?.access_role ??
  null;
const roleToAccessMode = (role) => (role === "edicio" ? "edicio" : role === "consulta" ? "consulta" : null);
const isEditor = () => state.accessMode === "edicio";

function shouldShowInstallPrompt() {
  return isMobileDevice() && !isStandaloneMode() && !hasSeenInstallPrompt();
}

function getInstallInstructions() {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIOS) {
    return "Obre el menú de compartir del Safari i toca «A la pantalla d'inici» per tenir l'app instal·lada.";
  }

  if (deferredInstallPromptEvent) {
    return "Instal·la-la ara per obrir-la com una app independent i tenir-la més a mà.";
  }

  return "Si el navegador no mostra el botó d'instal·lació, obre el menú i tria «Instal·la l'app» o «Afegeix a la pantalla d'inici».";
}

// Els estats d'incidència antics no han de quedar oberts: es mostren com a lliure o assignat.
const LEGACY_INCIDENT_STATES = ["incidencia_menor", "pendent_reparacio_interna"];
function normalizeComputerStatus(status, userId) {
  if (!LEGACY_INCIDENT_STATES.includes(status)) return status;
  return userId ? "assignat" : "lliure";
}

function getUser(userId) {
  return state.users.find((item) => item.id === userId) ?? null;
}

function activeUsers() {
  return state.users.filter((item) => item.actiu !== false);
}

function usersForSelection(selectedUserId = "") {
  return state.users.filter((item) => item.actiu !== false || item.id === selectedUserId);
}

// Actius primer i, dins de cada grup, per ordre alfabètic.
function compareUsers(a, b) {
  return (
    Number(a.actiu === false) - Number(b.actiu === false) ||
    `${a.nom} ${a.cognoms}`.localeCompare(`${b.nom} ${b.cognoms}`, "ca")
  );
}

function userName(userId) {
  const user = getUser(userId);
  return user ? `${user.nom} ${user.cognoms}`.trim() : "Sense assignar";
}

function filteredResults() {
  const query = state.query.trim().toLowerCase();
  if (!query) return { computers: [], users: [] };

  return {
    computers: state.computers.filter((item) => {
      const currentUser = userName(item.usuariActualId).toLowerCase();
      return (
        item.codi.toLowerCase().includes(query) ||
        currentUser.includes(query) ||
        (item.observacions ?? "").toLowerCase().includes(query)
      );
    }),
    users: state.users
      .filter((item) => `${item.nom} ${item.cognoms}`.trim().toLowerCase().includes(query))
      .sort(compareUsers),
  };
}

function selectedComputer() {
  return state.selectedResult?.type === "computer"
    ? state.computers.find((item) => item.id === state.selectedResult.id) ?? null
    : null;
}

function selectedUser() {
  return state.selectedResult?.type === "user"
    ? state.users.find((item) => item.id === state.selectedResult.id) ?? null
    : null;
}

function computerEvents(computerId) {
  return state.events
    .filter((item) => item.ordinadorId === computerId)
    .sort((a, b) => byDateDesc(a.data, b.data));
}

function userEvents(userId) {
  return state.events
    .filter((item) => item.usuariId === userId)
    .sort((a, b) => byDateDesc(a.data, b.data));
}

function computerAssignments(computerId) {
  return state.assignments
    .filter((item) => item.ordinadorId === computerId)
    .sort((a, b) => byDateDesc(a.dataInici, b.dataInici));
}

function userAssignments(userId) {
  return state.assignments
    .filter((item) => item.usuariId === userId)
    .sort((a, b) => byDateDesc(a.dataInici, b.dataInici));
}

function activeAssignment(computerId) {
  return state.assignments.find((item) => item.ordinadorId === computerId && !item.dataFinal);
}

function actionsForComputer(computer) {
  const hasUser = Boolean(computer.usuariActualId);
  return QUICK_ACTIONS.filter((action) => action.availableIn.includes(computer.estat))
    .filter((action) => !action.requiresCurrentUser || hasUser)
    .map((action) => {
      if (action.id === "assignacio" && hasUser) {
        return { ...action, label: "Reassignar", helper: "Tanca l'assignació actual i n'obre una de nova" };
      }
      if (action.id === "retorn" && computer.estat === "pendent_servei_tecnic_extern") {
        return { ...action, label: "Treure l'usuari", helper: "L'equip deixa de constar a nom de l'usuari" };
      }
      if (action.id === "reparat" && computer.estat === "pendent_servei_tecnic_extern") {
        return { ...action, label: "Marcar com reparat", helper: "L'equip torna del servei tècnic" };
      }
      return action;
    });
}

function currentAction() {
  const computer = selectedComputer();
  if (!computer) return null;
  return actionsForComputer(computer).find((item) => item.id === state.currentActionId) ?? null;
}

// Tradueix l'acció triada i les opcions del formulari en el canvi que cal desar.
function actionOutcome(action, computer, formData) {
  const currentUserId = computer.usuariActualId;
  const base = { label: action.label, nextUserId: currentUserId, nextState: computer.estat, closesAssignment: false };

  switch (action.id) {
    case "assignacio":
      return {
        ...base,
        eventType: currentUserId ? "canvi_propietari" : "assignacio",
        nextUserId: formData.usuariId,
        nextState: "assignat",
      };
    case "retorn":
      return {
        ...base,
        eventType: "retorn",
        nextUserId: null,
        nextState: computer.estat === "pendent_servei_tecnic_extern" ? computer.estat : "lliure",
        closesAssignment: true,
      };
    case "incidencia":
      return { ...base, eventType: "incidencia" };
    case "servei_tecnic_extern":
      return { ...base, eventType: "servei_tecnic_extern", nextState: "pendent_servei_tecnic_extern" };
    case "reparat":
      return currentUserId && formData.opcio !== "lliure"
        ? { ...base, eventType: "reparat", nextState: "assignat" }
        : { ...base, eventType: "reparat", nextUserId: null, nextState: "lliure", closesAssignment: true };
    case "reactivar":
      return { ...base, eventType: "reparat", nextUserId: null, nextState: "lliure" };
    case "baixa":
      return { ...base, eventType: "baixa", nextUserId: null, nextState: "fora_servei", closesAssignment: true };
    default:
      return { ...base, eventType: "observacio" };
  }
}

const CHARGER_PATTERN = /carregador/i;
const REPAIR_TYPES = ["reparacio_interna", "servei_tecnic_extern"];

function renderHistorySummary(events, people) {
  const incidents = events.filter((event) => event.tipus === "incidencia").length;
  const repairs = events.filter((event) => REPAIR_TYPES.includes(event.tipus)).length;
  const chargers = events.filter((event) => CHARGER_PATTERN.test(event.descripcio ?? "")).length;
  return `
    <article class="detail-card history-summary">
      <h3>Resum de l'historial</h3>
      <div class="history-stats">
        <div><strong>${new Set(people.items).size}</strong><span>${text(people.label)}</span></div>
        <div><strong>${incidents}</strong><span>Incidències</span></div>
        <div><strong>${repairs}</strong><span>Reparacions</span></div>
        <div><strong>${chargers}</strong><span>Carregadors</span></div>
      </div>
      ${
        people.items.length
          ? `<p class="history-path"><span>${text(people.pathLabel)}</span> ${people.items.map((name) => text(name)).join(" → ")}</p>`
          : ""
      }
    </article>
  `;
}

// Llista sense repeticions consecutives, de més antic a més recent.
function chronologicalNames(assignments, nameOf) {
  return [...assignments]
    .sort((a, b) => byDateDesc(b.dataInici, a.dataInici))
    .map(nameOf)
    .filter((name, index, list) => name !== list[index - 1]);
}

function otherActiveComputers(userId, computerId) {
  if (!userId) return [];
  return state.computers.filter((item) => item.usuariActualId === userId && item.id !== computerId);
}

function currentEditedEvent() {
  return state.events.find((item) => item.id === state.editEventId) ?? null;
}

function currentEditedUser() {
  return state.users.find((item) => item.id === state.editUserId) ?? null;
}

function isStructuralEventType(eventType) {
  return [
    "assignacio",
    "retorn",
    "canvi_propietari",
    "reparacio_interna",
    "servei_tecnic_extern",
    "reparat",
    "baixa",
  ].includes(eventType);
}

function eventTone(eventType, status) {
  if (status === "fora_servei" || eventType === "baixa") return "danger";
  if (eventType === "servei_tecnic_extern") return "danger";
  if (eventType === "reparacio_interna" || eventType === "incidencia") return "warning";
  if (eventType === "assignacio" || eventType === "reparat") return "positive";
  return "neutral";
}

function eventIcon(eventType) {
  return ACTION_ICONS[eventType] ?? ACTION_ICONS.observacio;
}

function statusTextClass(status) {
  if (status === "fora_servei") return "status-text-baixa";
  if (status === "assignat") return "status-text-assignat";
  return "";
}

function eventHighlightClass(event, computerStatus) {
  if (event.tipus === "assignacio" || event.tipus === "canvi_propietari") {
    return "status-text-assignat";
  }
  if (event.tipus === "baixa") return "status-text-baixa";

  const searchableText = `${EVENT_TYPE_LABELS[event.tipus] ?? ""} ${event.descripcio ?? ""}`.toLowerCase();
  if (computerStatus === "fora_servei" && searchableText.includes("baixa")) {
    return "status-text-baixa";
  }
  if (searchableText.includes("baixa")) {
    return "status-text-baixa";
  }

  return "";
}

function summaryForComputer(item) {
  const events = computerEvents(item.id);
  return {
    totalEvents: events.length,
    lastEvent: events[0] ?? null,
  };
}

function normalizeComputerCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replaceAll(/\s+/g, "")
    .trim();
}

function footerMarkup() {
  return `
    <footer class="app-footer">
      <img class="license-mark" src="./CC_BY-NC-SA.svg" alt="Llicència CC BY-NC-SA" />
      <div class="footer-copy">
        <p>
          Aplicació creada per
          <a href="https://ja.cat/felipsarroca" target="_blank" rel="noreferrer">Felip Sarroca</a>
          amb assistència de la IA
        </p>
        <p>
          Obra sota llicència
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>
        </p>
      </div>
    </footer>
  `;
}

function renderWithSearchFocus() {
  render();
  requestAnimationFrame(() => {
    const input = document.querySelector("#search-input");
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  });
}

function scheduleSearchRender() {
  if (searchRenderTimer) clearTimeout(searchRenderTimer);
  searchRenderTimer = setTimeout(() => {
    renderWithSearchFocus();
    searchRenderTimer = null;
  }, 140);
}

function bindPress(target, handler) {
  target.addEventListener("click", handler);
  target.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handler(event);
  });
}

function renderInstallPrompt() {
  if (!state.installPromptVisible) return "";

  const hasNativePrompt = Boolean(deferredInstallPromptEvent);

  return `
    <div class="modal-overlay install-overlay">
      <section class="panel modal-panel install-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Instal·lació</p>
            <h2>Vols instal·lar l'app?</h2>
          </div>
          <button type="button" class="ghost-button compact-button" id="dismiss-install-prompt">Ara no</button>
        </div>
        <p class="install-copy">${text(getInstallInstructions())}</p>
        <div class="install-actions">
          ${
            hasNativePrompt
              ? '<button type="button" class="primary-button" id="confirm-install-prompt">Instal·la ara</button>'
              : ""
          }
          <button type="button" class="ghost-button" id="close-install-prompt">${
            hasNativePrompt ? "Més tard" : "Entesos"
          }</button>
        </div>
      </section>
    </div>
  `;
}

function bindInstallPromptEvents() {
  const closePrompt = () => {
    state.installPromptVisible = false;
    markInstallPromptSeen();
    render();
  };

  document.querySelector("#dismiss-install-prompt") && bindPress(document.querySelector("#dismiss-install-prompt"), closePrompt);
  document.querySelector("#close-install-prompt") && bindPress(document.querySelector("#close-install-prompt"), closePrompt);

  document.querySelector("#confirm-install-prompt") &&
    bindPress(document.querySelector("#confirm-install-prompt"), async () => {
      if (!deferredInstallPromptEvent) {
        closePrompt();
        return;
      }

      try {
        await deferredInstallPromptEvent.prompt();
        await deferredInstallPromptEvent.userChoice;
      } catch (error) {
        console.error("No s'ha pogut mostrar el diàleg d'instal·lació.", error);
      } finally {
        deferredInstallPromptEvent = null;
        closePrompt();
      }
    });
}

function renderAuthAccess() {
  app.innerHTML = `
    <main class="gate-shell">
      <section class="panel gate-panel">
        <p class="eyebrow">Accés</p>
        <h1>Gestió d'equips informàtics</h1>
        <p class="hero-copy">Inicia sessió amb l'usuari autoritzat del centre.</p>
        <form class="gate-form" id="access-form" autocomplete="off">
          <label>
            <span class="search-label">Correu electrònic</span>
            <input
              id="auth-email"
              name="email"
              type="email"
              value="${text(state.authEmail)}"
              placeholder="usuari@centre.cat"
              autocomplete="username"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              required
            />
          </label>
          <label>
            <span class="search-label">Contrasenya</span>
            <input
              id="auth-password"
              name="password"
              type="password"
              value="${text(state.authPassword)}"
              placeholder="Contrasenya"
              autocomplete="current-password"
              required
            />
          </label>
          <button type="submit" class="primary-button" ${state.isAuthenticating ? "disabled" : ""}>
            ${state.isAuthenticating ? "Entrant..." : "Entrar"}
          </button>
        </form>
        ${state.accessError ? `<p class="error-text">${text(state.accessError)}</p>` : ""}
      </section>
      ${footerMarkup()}
    </main>
    ${renderInstallPrompt()}
  `;

  document.querySelector("#auth-email")?.addEventListener("input", (event) => {
    state.authEmail = event.target.value;
  });
  document.querySelector("#auth-password")?.addEventListener("input", (event) => {
    state.authPassword = event.target.value;
  });
  document.querySelector("#access-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await signIn();
  });

  bindInstallPromptEvents();
}

async function signIn() {
  state.isAuthenticating = true;
  state.accessError = "";
  render();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: state.authEmail.trim(),
      password: state.authPassword,
    });
    if (error) throw error;

    const accessMode = roleToAccessMode(userRole(data.user));
    if (!accessMode) {
      await supabase.auth.signOut();
      throw new Error("Aquest usuari no té cap rol de consulta o edició assignat.");
    }

    state.authUser = data.user;
    state.accessMode = accessMode;
    state.authPassword = "";
    state.accessError = "";
    state.isAuthenticating = false;
    try {
      localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, state.authEmail.trim());
    } catch {}
    render();
    await loadSupabaseData();
  } catch (error) {
    state.authUser = null;
    state.accessMode = null;
    state.accessError = error.message ?? "No s'ha pogut iniciar sessió.";
    state.isAuthenticating = false;
    render();
  }
}

async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("No s'ha pogut tancar la sessió.", error);
  } finally {
    state.authUser = null;
    state.accessMode = null;
    state.authPassword = "";
    state.query = "";
    state.selectedResult = null;
    state.adminOpen = false;
    state.peopleOpen = false;
    state.adminUsers = [];
    state.adminMessage = "";
    state.adminError = "";
    state.source = "local";
    state.syncMessage = "Sessió tancada";
    render();
  }
}

async function restoreSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    render();
    return;
  }

  const accessMode = roleToAccessMode(userRole(data.session.user));
  if (!accessMode) {
    await supabase.auth.signOut();
    state.accessError = "Aquest usuari no té cap rol de consulta o edició assignat.";
    render();
    return;
  }

  state.authUser = data.session.user;
  state.authEmail = data.session.user.email ?? state.authEmail;
  state.accessMode = accessMode;
  try {
    if (state.authEmail) localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, state.authEmail);
  } catch {}
  render();
  await loadSupabaseData();
}

function renderResults(results) {
  if (!state.query.trim()) {
    if (state.adminOpen || state.inventoryOpen) return "";

    return `
      <section class="panel empty-state">
        <h2>Cerca un equip o un usuari</h2>
        <p>Escriu un codi RPPO o un nom. Només es mostrarà la fitxa del resultat que triïs.</p>
      </section>
    `;
  }

  if (!results.computers.length && !results.users.length) {
    return `
      <section class="panel empty-state">
        <h2>Sense coincidències</h2>
        <p>No hi ha cap equip ni usuari que coincideixi amb la cerca.</p>
      </section>
    `;
  }

  return `
    <section class="panel results-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Resultats</p>
          <h2>Coincidències trobades</h2>
        </div>
      </div>
      <div class="results-grid">
        ${results.computers
          .map(
            (item) => `
              <button type="button" class="result-card ${
                state.selectedResult?.type === "computer" && state.selectedResult.id === item.id ? "selected" : ""
              }" data-result-type="computer" data-result-id="${item.id}">
                <strong>${text(item.codi)}</strong>
                <p class="${statusTextClass(item.estat)}">${text(ESTATS[item.estat])}</p>
                <small>${text(userName(item.usuariActualId))}</small>
              </button>
            `,
          )
          .join("")}
        ${results.users
          .map(
            (item) => `
              <button type="button" class="result-card user-card ${
                state.selectedResult?.type === "user" && state.selectedResult.id === item.id ? "selected" : ""
              }" data-result-type="user" data-result-id="${item.id}">
                <strong>${text(`${item.nom} ${item.cognoms}`.trim())}</strong>
                <p>Usuari ${item.actiu === false ? "inactiu" : "actiu"}</p>
                <small>${text(item.tipusUsuari)}</small>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

const INVENTORY_FILTERS = [
  { id: "tots", label: "Tots" },
  { id: "lliure", label: "Lliures" },
  { id: "assignat", label: "Assignats" },
  { id: "pendent_servei_tecnic_extern", label: "Rep. major" },
  { id: "fora_servei", label: "Baixa" },
];

function filterMatches(filterId, status) {
  if (filterId === "tots") return true;
  const filter = INVENTORY_FILTERS.find((item) => item.id === filterId);
  return (filter?.states ?? [filterId]).includes(status);
}

const compareComputerCodes = (a, b) => a.codi.localeCompare(b.codi, "ca", { numeric: true });

function inventoryRows() {
  const query = state.inventoryQuery.trim().toLowerCase();
  const rows = state.computers
    .filter((item) => filterMatches(state.inventoryFilter, item.estat))
    .map((item) => ({ item, lastEvent: computerEvents(item.id)[0] ?? null }))
    .filter(({ item, lastEvent }) => {
      if (!query) return true;
      return [item.codi, userName(item.usuariActualId), item.observacions, lastEvent?.descripcio]
        .some((value) => (value ?? "").toLowerCase().includes(query));
    });

  const statusOrder = Object.keys(ESTATS);
  return rows.sort((a, b) => {
    if (state.inventorySort === "estat") {
      return statusOrder.indexOf(a.item.estat) - statusOrder.indexOf(b.item.estat) || compareComputerCodes(a.item, b.item);
    }
    if (state.inventorySort === "data") {
      return byDateDesc(a.lastEvent?.data ?? 0, b.lastEvent?.data ?? 0) || compareComputerCodes(a.item, b.item);
    }
    if (state.inventorySort === "usuari") {
      return userName(a.item.usuariActualId).localeCompare(userName(b.item.usuariActualId), "ca") || compareComputerCodes(a.item, b.item);
    }
    return compareComputerCodes(a.item, b.item);
  });
}

function renderInventory() {
  if (!state.inventoryOpen) return "";

  const counts = Object.fromEntries(
    INVENTORY_FILTERS.map((filter) => [filter.id, state.computers.filter((item) => filterMatches(filter.id, item.estat)).length]),
  );
  const rows = inventoryRows();

  return `
    <section class="panel inventory-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Inventari</p>
          <h2>Estat de tots els ordinadors</h2>
        </div>
        ${isEditor() ? '<button type="button" class="primary-button compact-button" id="inventory-new-computer">Nou equip</button>' : ""}
      </div>
      <div class="inventory-filters" role="group" aria-label="Filtra per estat">
        ${INVENTORY_FILTERS.map(
          (filter) => `
            <button
              type="button"
              class="inventory-filter inv-${filter.id} ${state.inventoryFilter === filter.id ? "active" : ""}"
              data-inventory-filter="${filter.id}"
              aria-pressed="${state.inventoryFilter === filter.id}"
            >
              <strong>${counts[filter.id] ?? 0}</strong>
              <span>${text(filter.label)}</span>
            </button>
          `,
        ).join("")}
      </div>
      <div class="inventory-tools">
        <label class="inventory-search">
          <span class="search-label">Filtra la llista</span>
          <input id="inventory-search" type="search" value="${text(state.inventoryQuery)}" placeholder="Codi, usuari o text d'una incidència" />
        </label>
        <label class="inventory-sort">
          <span class="search-label">Ordena per</span>
          <select id="inventory-sort">
            <option value="codi" ${state.inventorySort === "codi" ? "selected" : ""}>Codi RPPO</option>
            <option value="estat" ${state.inventorySort === "estat" ? "selected" : ""}>Estat</option>
            <option value="usuari" ${state.inventorySort === "usuari" ? "selected" : ""}>Usuari</option>
            <option value="data" ${state.inventorySort === "data" ? "selected" : ""}>Últim moviment</option>
          </select>
        </label>
      </div>
      <p class="inventory-count">${rows.length} ${rows.length === 1 ? "ordinador" : "ordinadors"}</p>
      ${
        rows.length
          ? `<div class="inventory-list">
              <div class="inventory-row inventory-head" aria-hidden="true">
                <span>Equip</span><span>Estat</span><span>Qui el té</span><span>Últim moviment</span>
              </div>
              ${rows
                .map(
                  ({ item, lastEvent }) => `
                    <button
                      type="button"
                      class="inventory-row ${
                        state.selectedResult?.type === "computer" && state.selectedResult.id === item.id ? "selected" : ""
                      }"
                      data-inventory-id="${item.id}"
                    >
                      <strong class="inv-code">${text(item.codi)}</strong>
                      <span class="inv-status"><span class="inv-dot inv-${item.estat}"></span>${text(ESTATS[item.estat] ?? item.estat)}</span>
                      <span class="inv-user ${item.usuariActualId ? "" : "is-empty"}">${text(userName(item.usuariActualId))}</span>
                      <span class="inv-last">${
                        lastEvent
                          ? `<span class="inv-last-meta">${text(formatDate(lastEvent.data))} · ${text(EVENT_TYPE_LABELS[lastEvent.tipus] ?? lastEvent.tipus)}</span>
                             <span class="inv-last-text">${text(lastEvent.descripcio)}</span>`
                          : `<span class="inv-last-meta">Sense moviments</span>`
                      }</span>
                    </button>
                  `,
                )
                .join("")}
            </div>`
          : `<p class="help-text">Cap ordinador coincideix amb aquest filtre.</p>`
      }
    </section>
  `;
}

function renderAdminPanel() {
  if (!state.adminOpen || !isEditor()) return "";

  return `
    <section class="panel admin-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Accessos</p>
          <h2>Comptes que poden entrar a l'app</h2>
        </div>
        <button type="button" class="ghost-button compact-button" id="refresh-admin-users" ${state.isAdminLoading ? "disabled" : ""}>
          Actualitzar
        </button>
      </div>

      <form class="admin-form" id="admin-create-user-form" autocomplete="off">
        <label>
          <span>Correu</span>
          <input id="admin-email" type="email" value="${text(state.adminForm.email)}" placeholder="persona@centre.cat" required />
        </label>
        <label>
          <span>Contrasenya inicial</span>
          <input id="admin-password" type="password" value="${text(state.adminForm.password)}" minlength="8" placeholder="Mínim 8 caràcters" required />
        </label>
        <label>
          <span>Rol</span>
          <select id="admin-role">
            <option value="consulta" ${state.adminForm.role === "consulta" ? "selected" : ""}>Consulta</option>
            <option value="edicio" ${state.adminForm.role === "edicio" ? "selected" : ""}>Edició</option>
          </select>
        </label>
        <button type="submit" class="primary-button" ${state.isAdminLoading ? "disabled" : ""}>
          ${state.isAdminLoading ? "Gestionant..." : "Crear accés"}
        </button>
      </form>

      ${state.adminMessage ? `<p class="help-text">${text(state.adminMessage)}</p>` : ""}
      ${state.adminError ? `<p class="error-text">${text(state.adminError)}</p>` : ""}

      <div class="admin-users">
        ${
          state.adminUsers.length
            ? state.adminUsers
                .map(
                  (user) => `
                    <article class="admin-user-row">
                      <div>
                        <strong>${text(user.email ?? "Sense correu")}</strong>
                        <small>${user.disabled ? "Accés desactivat" : "Accés actiu"} · Rol: ${text(user.role ?? "sense rol")}</small>
                      </div>
                      <div class="admin-user-actions">
                        <button type="button" class="ghost-button compact-button" data-admin-role="consulta" data-user-id="${text(user.id)}" ${state.isAdminLoading ? "disabled" : ""}>Consulta</button>
                        <button type="button" class="ghost-button compact-button" data-admin-role="edicio" data-user-id="${text(user.id)}" ${state.isAdminLoading ? "disabled" : ""}>Edició</button>
                        <button type="button" class="ghost-button compact-button" data-admin-disable data-user-id="${text(user.id)}" ${state.isAdminLoading || user.id === state.authUser?.id ? "disabled" : ""}>
                          ${user.disabled ? "Reactivar" : "Desactivar"}
                        </button>
                        <button type="button" class="danger-button compact-button" data-admin-delete data-user-id="${text(user.id)}" ${state.isAdminLoading || user.id === state.authUser?.id ? "disabled" : ""}>Eliminar</button>
                      </div>
                    </article>
                  `,
                )
                .join("")
            : `<p class="help-text">${state.isAdminLoading ? "Carregant accessos..." : "Encara no s'ha carregat cap accés."}</p>`
        }
      </div>
    </section>
  `;
}

// Clau per detectar possibles duplicats: sense accents, majúscules ni espais.
const nameKey = (user) =>
  `${user.nom} ${user.cognoms}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function userHasHistory(userId) {
  return (
    state.assignments.some((item) => item.usuariId === userId) ||
    state.events.some((item) => item.usuariId === userId) ||
    state.computers.some((item) => item.usuariActualId === userId)
  );
}

function renderPeopleRow(user, keyCounts) {
  const computers = state.computers.filter((computer) => computer.usuariActualId === user.id);
  const isDuplicate = keyCounts.get(nameKey(user)) > 1;
  return `
    <article class="people-row ${user.actiu === false ? "is-inactive" : ""}">
      <button type="button" class="people-open" data-people-open="${user.id}">
        <strong>${text(`${user.nom} ${user.cognoms}`.trim())}</strong>
        <small>${user.tipusUsuari === "generic" ? "Genèric" : "Alumne"}${user.actiu === false ? " · Inactiu" : ""} · ${
          computers.length ? text(computers.map((computer) => computer.codi).join(", ")) : "Sense equip"
        }</small>
      </button>
      ${isDuplicate ? '<span class="people-dup">Possible duplicat</span>' : ""}
      ${
        isEditor()
          ? `<button type="button" class="ghost-button compact-button" data-people-edit="${user.id}">Editar</button>`
          : ""
      }
    </article>
  `;
}

function renderPeoplePanel() {
  if (!state.peopleOpen) return "";

  const query = state.peopleQuery.trim().toLowerCase();
  const keyCounts = state.users.reduce((counts, user) => counts.set(nameKey(user), (counts.get(nameKey(user)) ?? 0) + 1), new Map());
  const rows = state.users
    .filter((user) => !query || `${user.nom} ${user.cognoms}`.toLowerCase().includes(query))
    .sort(compareUsers);
  const activeRows = rows.filter((user) => user.actiu !== false);
  const inactiveRows = rows.filter((user) => user.actiu === false);
  const duplicates = state.users.filter((user) => keyCounts.get(nameKey(user)) > 1).length;

  return `
    <section class="panel people-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Usuaris</p>
          <h2>Persones que fan servir els ordinadors</h2>
        </div>
        ${isEditor() ? '<button type="button" class="primary-button compact-button" id="people-new-user">Nou usuari</button>' : ""}
      </div>
      <label class="people-search">
        <span class="search-label">Filtra per nom</span>
        <input id="people-search" type="search" value="${text(state.peopleQuery)}" placeholder="Nom o cognoms" />
      </label>
      <p class="inventory-count">${activeRows.length} ${activeRows.length === 1 ? "usuari actiu" : "usuaris actius"}${
        inactiveRows.length ? ` · ${inactiveRows.length} ${inactiveRows.length === 1 ? "inactiu" : "inactius"}` : ""
      }${
        duplicates ? ` · <span class="people-dup-note">${duplicates} amb el nom repetit</span>` : ""
      }</p>
      ${activeRows.length ? `<div class="people-list">${activeRows.map((user) => renderPeopleRow(user, keyCounts)).join("")}</div>` : ""}
      ${
        inactiveRows.length
          ? `<h3 class="people-group-title">Usuaris inactius</h3>
             <div class="people-list">${inactiveRows.map((user) => renderPeopleRow(user, keyCounts)).join("")}</div>`
          : ""
      }
    </section>
  `;
}

function renderComputerDetail(item) {
  const events = computerEvents(item.id);
  const assignments = computerAssignments(item.id);
  const summary = summaryForComputer(item);

  return `
    <section class="panel detail-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Fitxa d'ordinador</p>
          <h2>${text(item.codi)}</h2>
        </div>
        <div class="detail-header-actions">
          <span class="status-badge status-${item.estat}">${text(ESTATS[item.estat])}</span>
          ${
            isEditor()
              ? '<button type="button" class="compact-button user-edit-button" id="edit-computer-button">Editar equip</button>'
              : ""
          }
        </div>
      </div>

      <div class="info-strip">
        <div class="info-chip">
          <span class="info-chip-label">Usuari actual</span>
          <strong>${text(userName(item.usuariActualId))}</strong>
        </div>
        <div class="info-chip">
          <span class="info-chip-label">Esdeveniments</span>
          <strong>${summary.totalEvents}</strong>
        </div>
        <div class="info-chip">
          <span class="info-chip-label">Últim moviment</span>
          <strong>${summary.lastEvent ? text(formatDate(summary.lastEvent.data)) : "Sense dades"}</strong>
        </div>
      </div>

      ${renderHistorySummary(events, {
        label: "Usuaris",
        pathLabel: "Ha passat per:",
        items: chronologicalNames(assignments, (assignment) => userName(assignment.usuariId)),
      })}

      <article class="detail-card action-card">
        <div class="action-panel-head">
          <div>
            <h3>Registrar acció</h3>
            <p class="action-panel-copy">Només es mostren les accions possibles en l'estat actual.</p>
          </div>
          <div class="action-panel-buttons">
            <button type="button" class="primary-button compact-button" id="toggle-actions" ${
              state.accessMode !== "edicio" ? "disabled" : ""
            }>
              ${state.showActionPanel ? "Amagar accions" : "Mostrar accions"}
            </button>
          </div>
        </div>
        ${
          state.showActionPanel
            ? `<div class="quick-actions">
                ${actionsForComputer(item).map(
                  (action) => `
                    <button
                      type="button"
                      class="action-button tone-${action.tone}"
                      data-action-id="${action.id}"
                      ${state.accessMode !== "edicio" || state.isSaving ? "disabled" : ""}
                    >
                      <span class="action-icon">${action.icon}</span>
                      <span class="action-copy">
                        <strong>${text(action.label)}</strong>
                        <small>${text(action.helper)}</small>
                      </span>
                    </button>
                  `,
                ).join("")}
              </div>`
            : ""
        }
        ${
          state.accessMode === "consulta"
            ? `<p class="help-text">Estàs en mode consulta. Per editar cal entrar amb el codi d'edició.</p>`
            : ""
        }
      </article>

      <article class="timeline-card">
        <h3>Historial d'esdeveniments</h3>
        <div class="timeline">
          ${events
            .map(
              (event) => `
                <button
                  type="button"
                  class="timeline-item timeline-button tone-${eventTone(event.tipus, item.estat)} ${
                    state.accessMode === "edicio" ? "is-editable" : ""
                  }"
                  data-event-id="${event.id}"
                  ${state.accessMode !== "edicio" ? "disabled" : ""}
                >
                  <div class="timeline-meta">
                    <span class="event-badge">${eventIcon(event.tipus)}</span>
                    <span>${text(formatDate(event.data))}</span>
                    <strong class="${eventHighlightClass(event, item.estat)}">${text(EVENT_TYPE_LABELS[event.tipus] ?? event.tipus)}</strong>
                  </div>
                  <p class="${eventHighlightClass(event, item.estat)}">${text(event.descripcio)}</p>
                  <small>${text(userName(event.usuariId))}</small>
                </button>
              `,
            )
            .join("")}
        </div>
      </article>

      <article class="timeline-card">
        <h3>Assignacions</h3>
        <div class="timeline">
          ${assignments
            .map(
              (assignment) => `
                <div class="timeline-item tone-positive">
                  <div class="timeline-meta">
                    <span class="event-badge">${ACTION_ICONS.assignacio}</span>
                    <span>${text(formatDate(assignment.dataInici))}</span>
                    <strong>${text(userName(assignment.usuariId))}</strong>
                  </div>
                  <p>Curs ${text(assignment.cursAcademic)}</p>
                  <small>${
                    assignment.dataFinal ? `Fins a ${text(formatDate(assignment.dataFinal))}` : "Assignació activa"
                  }</small>
                </div>
              `,
            )
            .join("")}
        </div>
      </article>
    </section>
  `;
}

function renderUserDetail(item) {
  const assignments = userAssignments(item.id);
  const events = userEvents(item.id);
  const currentComputers = state.computers.filter((computer) => computer.usuariActualId === item.id);
  const computerCode = (computerId) => state.computers.find((computer) => computer.id === computerId)?.codi ?? "Equip desconegut";

  return `
    <section class="panel detail-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Fitxa d'usuari</p>
          <h2>${text(`${item.nom} ${item.cognoms}`.trim())}</h2>
        </div>
        <div class="detail-header-actions">
          <span class="user-chip ${item.actiu === false ? "user-chip-inactive" : "user-chip-active"}">
            <span class="user-chip-icon" aria-hidden="true">
              ${
                item.actiu === false
                  ? `<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="7.2"></circle><path d="M8.3 8.3 15.7 15.7"></path><path d="M15.7 8.3 8.3 15.7"></path></svg>`
                  : `<svg viewBox="0 0 24 24" focusable="false"><path d="M12 4.8 18 7.2v4.7c0 3-2 5.6-6 7.3-4-1.7-6-4.3-6-7.3V7.2L12 4.8Z"></path><path d="m9.2 12.2 2.1 2.1 4.2-4.3"></path></svg>`
              }
            </span>
            <span>${item.actiu === false ? "Inactiu" : "Actiu"}</span>
          </span>
          <span class="user-chip user-chip-type">
            <span class="user-chip-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="12" cy="8.5" r="2.6"></circle>
                <path d="M7.2 18c.8-2.5 2.5-3.8 4.8-3.8s4 1.3 4.8 3.8"></path>
              </svg>
            </span>
            <span>${text(item.tipusUsuari === "generic" ? "Genèric" : "Alumne")}</span>
          </span>
          ${
            state.accessMode === "edicio"
              ? '<button type="button" class="compact-button user-edit-button" id="edit-user-button">Editar usuari</button>'
              : ""
          }
        </div>
      </div>

      <div class="detail-grid">
        <article class="detail-card">
          <h3>Situació actual</h3>
          <dl>
            <div><dt>Ordinador actual</dt><dd>${
              currentComputers.length
                ? currentComputers.map((computer) => `${text(computer.codi)} (${text(ESTATS[computer.estat] ?? computer.estat)})`).join(", ")
                : "Cap equip assignat"
            }</dd></div>
            <div><dt>Total d'assignacions</dt><dd>${assignments.length}</dd></div>
            <div><dt>Estat</dt><dd>${item.actiu === false ? "Usuari inactiu" : "Usuari actiu"}</dd></div>
          </dl>
        </article>
        <article class="detail-card">
          <h3>Esdeveniments</h3>
          <p>${events.length ? `${events.length} esdeveniments relacionats` : "Cap esdeveniment registrat."}</p>
        </article>
      </div>

      ${renderHistorySummary(events, {
        label: "Equips",
        pathLabel: "Equips que ha tingut:",
        items: chronologicalNames(assignments, (assignment) => computerCode(assignment.ordinadorId)),
      })}

      <article class="timeline-card">
        <h3>Historial d'ordinadors</h3>
        <div class="timeline">
          ${assignments
            .map((assignment) => {
              const computer = state.computers.find((item2) => item2.id === assignment.ordinadorId);
              return `
                <div class="timeline-item tone-positive">
                  <div class="timeline-meta">
                    <span class="event-badge">${ACTION_ICONS.assignacio}</span>
                    <span>${text(formatDate(assignment.dataInici))}</span>
                    <strong>${text(computer?.codi ?? "Equip desconegut")}</strong>
                  </div>
                  <p>Curs ${text(assignment.cursAcademic)}</p>
                  <small>${assignment.dataFinal ? `Fins a ${text(formatDate(assignment.dataFinal))}` : "Assignació activa"}</small>
                </div>
              `;
            })
            .join("")}
        </div>
      </article>

      <article class="timeline-card">
        <h3>Esdeveniments relacionats</h3>
        <div class="timeline">
          ${events
            .map((event) => {
              const computer = state.computers.find((item2) => item2.id === event.ordinadorId);
              return `
                <button
                  type="button"
                  class="timeline-item timeline-button tone-${eventTone(event.tipus)} ${
                    state.accessMode === "edicio" ? "is-editable" : ""
                  }"
                  data-event-id="${event.id}"
                  ${state.accessMode !== "edicio" ? "disabled" : ""}
                >
                  <div class="timeline-meta">
                    <span class="event-badge">${eventIcon(event.tipus)}</span>
                    <span>${text(formatDate(event.data))}</span>
                    <strong>${text(EVENT_TYPE_LABELS[event.tipus] ?? event.tipus)}</strong>
                  </div>
                  <p>${text(event.descripcio)}</p>
                  <small>${text(computer?.codi ?? "Equip desconegut")}</small>
                </button>
              `;
            })
            .join("")}
        </div>
      </article>
    </section>
  `;
}

function renderModal() {
  if (state.creatorOpen) {
    return `
      <div class="modal-overlay">
        <section class="panel modal-panel">
          <div class="section-head">
            <div><p class="eyebrow">Nou registre</p><h2>${state.createData.kind === "computer" ? "Nou equip" : "Nou usuari"}</h2></div>
            <button type="button" class="ghost-button" id="close-modal">Tancar</button>
          </div>
          <form class="modal-form" id="create-form" autocomplete="off">
            ${
              state.createData.kind === "computer"
                ? `
                  <label>
                    <span>Codi RPPO</span>
                    <input id="create-computer-code" type="text" value="${text(state.createData.codi)}" placeholder="Ex.: RPPO145" required />
                  </label>
                `
                : `
                  <label>
                    <span>Nom</span>
                    <input id="create-user-name" type="text" value="${text(state.createData.nom)}" placeholder="Nom de l'usuari" required />
                  </label>
                  <label>
                    <span>Cognoms</span>
                    <input id="create-user-surname" type="text" value="${text(state.createData.cognoms)}" placeholder="Cognoms" />
                  </label>
                  <label>
                    <span>Tipus d'usuari</span>
                    <select id="create-user-type">
                      <option value="alumne" ${state.createData.tipusUsuari === "alumne" ? "selected" : ""}>Alumne</option>
                      <option value="generic" ${state.createData.tipusUsuari === "generic" ? "selected" : ""}>Genèric</option>
                    </select>
                  </label>
                `
            }
            <button type="submit" class="primary-button" ${state.isSaving ? "disabled" : ""}>
              ${state.isSaving ? "Desant..." : "Crear registre"}
            </button>
          </form>
        </section>
      </div>
    `;
  }

  const editedEvent = currentEditedEvent();
  if (editedEvent) {
    const computer = state.computers.find((item) => item.id === editedEvent.ordinadorId);
    const deleteWarning = isStructuralEventType(editedEvent.tipus)
      ? "Atenció: si elimines aquest esdeveniment, pot ser que l'estat actual o l'historial d'assignacions de l'equip ja no quadrin del tot."
      : "Atenció: aquesta acció elimina definitivament l'esdeveniment seleccionat.";
    return `
      <div class="modal-overlay">
        <section class="panel modal-panel">
          <div class="section-head">
            <div><p class="eyebrow">Esdeveniment</p><h2>Editar esdeveniment</h2></div>
            <button type="button" class="ghost-button" id="close-modal">Tancar</button>
          </div>
          <form class="modal-form" id="edit-event-form" autocomplete="off">
            <label><span>Ordinador</span><input type="text" value="${text(computer?.codi ?? "Equip desconegut")}" disabled /></label>
            <label><span>Tipus</span><input type="text" value="${text(EVENT_TYPE_LABELS[editedEvent.tipus] ?? editedEvent.tipus)}" disabled /></label>
            <label><span>Data</span><input id="edit-event-date" type="date" value="${text(state.editEventData.data)}" required /></label>
            <label>
              <span>Usuari</span>
              <select id="edit-event-user">
                <option value="">Sense usuari</option>
                ${usersForSelection(state.editEventData.usuariId)
                  .map(
                    (user) =>
                      `<option value="${user.id}" ${state.editEventData.usuariId === user.id ? "selected" : ""}>${text(
                        `${user.nom} ${user.cognoms}`.trim(),
                      )}</option>`,
                  )
                  .join("")}
              </select>
            </label>
            <label><span>Descripció</span><textarea id="edit-event-description" rows="4" required>${text(
              state.editEventData.descripcio,
            )}</textarea></label>
            <p class="modal-warning">${text(deleteWarning)}</p>
            <div class="modal-actions">
              <button type="button" class="danger-button" id="delete-event-button" ${state.isSaving ? "disabled" : ""}>
                ${state.isSaving ? "Eliminant..." : "Eliminar esdeveniment"}
              </button>
              <button type="submit" class="primary-button" ${state.isSaving ? "disabled" : ""}>
                ${state.isSaving ? "Desant..." : "Desar canvis"}
              </button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  const editedComputer = state.computers.find((item) => item.id === state.editComputerId);
  if (editedComputer) {
    return `
      <div class="modal-overlay">
        <section class="panel modal-panel">
          <div class="section-head">
            <div><p class="eyebrow">Equip</p><h2>Editar equip</h2></div>
            <button type="button" class="ghost-button" id="close-modal">Tancar</button>
          </div>
          <form class="modal-form" id="edit-computer-form" autocomplete="off">
            <label><span>Codi RPPO</span><input id="edit-computer-code" type="text" value="${text(state.editComputerCode)}" required /></label>
            <p class="modal-warning">L'historial i les assignacions de l'equip es mantenen; només canvia el codi.</p>
            <button type="submit" class="primary-button" ${state.isSaving ? "disabled" : ""}>
              ${state.isSaving ? "Desant..." : "Desar equip"}
            </button>
          </form>
        </section>
      </div>
    `;
  }

  const editedUser = currentEditedUser();
  if (editedUser) {
    const editedKey = nameKey(editedUser);
    const mergeCandidates = state.users
      .filter((user) => user.id !== editedUser.id)
      .sort(
        (a, b) =>
          Number(nameKey(b) === editedKey) - Number(nameKey(a) === editedKey) || compareUsers(a, b),
      );
    return `
      <div class="modal-overlay">
        <section class="panel modal-panel">
          <div class="section-head">
            <div><p class="eyebrow">Usuari</p><h2>Editar usuari</h2></div>
            <button type="button" class="ghost-button" id="close-modal">Tancar</button>
          </div>
          <form class="modal-form" id="edit-user-form" autocomplete="off">
            <label><span>Nom</span><input id="edit-user-name" type="text" value="${text(state.editUserData.nom)}" required /></label>
            <label><span>Cognoms</span><input id="edit-user-surname" type="text" value="${text(state.editUserData.cognoms)}" /></label>
            <label>
              <span>Tipus d'usuari</span>
              <select id="edit-user-type">
                <option value="alumne" ${state.editUserData.tipusUsuari === "alumne" ? "selected" : ""}>Alumne</option>
                <option value="generic" ${state.editUserData.tipusUsuari === "generic" ? "selected" : ""}>Genèric</option>
              </select>
            </label>
            <label>
              <span>Estat</span>
              <select id="edit-user-active">
                <option value="true" ${state.editUserData.actiu ? "selected" : ""}>Actiu</option>
                <option value="false" ${!state.editUserData.actiu ? "selected" : ""}>Inactiu</option>
              </select>
            </label>
            <p class="modal-warning">Els usuaris inactius mantenen l'historial, però ja no apareixen a la llista per assignar ordinadors nous.</p>
            <button type="submit" class="primary-button" ${state.isSaving ? "disabled" : ""}>
              ${state.isSaving ? "Desant..." : "Desar usuari"}
            </button>
          </form>
          <div class="user-cleanup">
            <h3>És un duplicat o un error?</h3>
            <p class="help-text">Tria l'usuari correcte: hi passaran els equips i tot l'historial, i aquest registre s'esborrarà.</p>
            <div class="user-merge-row">
              <select id="merge-target" aria-label="Usuari amb qui fusionar">
                <option value="">Fusiona amb...</option>
                ${mergeCandidates
                  .map(
                    (user) =>
                      `<option value="${user.id}" ${state.mergeTargetId === user.id ? "selected" : ""}>${text(
                        `${user.nom} ${user.cognoms}`.trim(),
                      )}${nameKey(user) === editedKey ? " (mateix nom)" : ""}</option>`,
                  )
                  .join("")}
              </select>
              <button type="button" class="ghost-button compact-button" id="merge-user-button" ${
                state.isSaving || !state.mergeTargetId ? "disabled" : ""
              }>Fusionar</button>
            </div>
            ${
              userHasHistory(editedUser.id)
                ? `<p class="help-text">Com que té historial, no es pot esborrar sense més: fusiona'l o marca'l com a inactiu.</p>`
                : `<button type="button" class="danger-button" id="delete-user-button" ${state.isSaving ? "disabled" : ""}>Esborrar usuari</button>`
            }
          </div>
        </section>
      </div>
    `;
  }

  const action = currentAction();
  const computer = selectedComputer();
  if (!action || !computer) return "";

  const currentUserName = userName(computer.usuariActualId);
  const choice = (name, options) => `
    <fieldset class="choice-group">
      ${options
        .map(
          (option) => `
            <label class="choice-option">
              <input type="radio" name="${name}" value="${option.value}" ${state.formData.opcio === option.value ? "checked" : ""} />
              <span>${text(option.label)}</span>
            </label>
          `,
        )
        .join("")}
    </fieldset>
  `;
  const otherComputers = action.requiresUser ? otherActiveComputers(state.formData.usuariId, computer.id) : [];
  let extraFields = "";
  if (action.id === "reparat" && computer.usuariActualId) {
    extraFields = choice("event-option", [
      { value: "tornar", label: `Torna a ${currentUserName}` },
      { value: "lliure", label: "Queda lliure" },
    ]);
  } else if (action.id === "baixa") {
    extraFields = `
      <label class="choice-option confirm-option">
        <input id="event-confirm" type="checkbox" required />
        <span>Confirmo que ${text(computer.codi)} queda fora de servei${
          computer.usuariActualId ? ` i deixa de constar a nom de ${text(currentUserName)}` : ""
        }.</span>
      </label>
    `;
  }

  return `
    <div class="modal-overlay">
      <section class="panel modal-panel">
        <div class="section-head">
          <div><p class="eyebrow">Nova acció</p><h2>${text(action.label)}</h2></div>
          <button type="button" class="ghost-button" id="close-modal">Tancar</button>
        </div>
        <form class="modal-form" id="action-form" autocomplete="off">
          <label><span>Ordinador</span><input type="text" value="${text(computer.codi)}" disabled /></label>
          <label><span>Data</span><input id="event-date" type="date" value="${text(state.formData.data)}" required /></label>
          ${
            action.requiresUser
              ? `<label><span>Usuari</span><select id="event-user" required><option value="">Selecciona un usuari</option>${activeUsers()
                  .map(
                    (user) =>
                      `<option value="${user.id}" ${state.formData.usuariId === user.id ? "selected" : ""}>${text(
                        `${user.nom} ${user.cognoms}`.trim(),
                      )}</option>`,
                  )
                  .join("")}</select></label>${
                  otherComputers.length
                    ? `<p class="form-note">Aquest usuari ja té: ${otherComputers
                        .map((item) => `${text(item.codi)} (${text(ESTATS[item.estat] ?? item.estat)})`)
                        .join(", ")}.</p>`
                    : ""
                }`
              : ""
          }
          ${extraFields}
          <label><span>Descripció</span><textarea id="event-description" rows="4" required>${text(
            state.formData.descripcio,
          )}</textarea></label>
          ${state.formError ? `<p class="form-error">${text(state.formError)}</p>` : ""}
          <button type="submit" class="primary-button" ${state.isSaving ? "disabled" : ""}>${
            state.isSaving ? "Desant..." : "Desar esdeveniment"
          }</button>
        </form>
      </section>
    </div>
  `;
}

function renderMain() {
  const results = filteredResults();
  const computer = selectedComputer();
  const user = selectedUser();

  app.innerHTML = `
    <main class="app-shell search-layout ${state.inventoryOpen ? "inventory-open" : ""} ${
      state.adminOpen || state.peopleOpen ? "panel-open" : ""
    }">
      <section class="panel hero-panel">
        <div class="hero-copy-block">
          <div class="hero-title-row">
            <img class="hero-logo" src="./favicon.svg" alt="Logotip de l'app" />
            <div class="hero-title-copy">
              <p class="eyebrow">Escola Ramon Pont</p>
              <h1>Control d'ordinadors<br />de préstec del centre</h1>
            </div>
          </div>
        </div>
        <label class="search-box search-box-web">
          <span class="search-label">Cerca immediata</span>
          <span class="search-entry">
            <span class="search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="11" cy="11" r="6.5"></circle>
                <path d="m16 16 4 4"></path>
              </svg>
            </span>
            <input id="search-input" type="search" value="${text(state.query)}" placeholder="Ex.: RPPO64, Yahya, Fatima..." />
          </span>
        </label>
      </section>

      <div class="hero-tools">
        <label class="search-box search-box-mobile">
          <span class="search-label">Cerca immediata</span>
          <span class="search-entry">
            <span class="search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="11" cy="11" r="6.5"></circle>
                <path d="m16 16 4 4"></path>
              </svg>
            </span>
            <input id="search-input-mobile" type="search" value="${text(state.query)}" placeholder="Ex.: RPPO64, Yahya, Fatima..." />
          </span>
        </label>
        <div class="topbar">
          <span class="mode-badge mode-${state.accessMode === "edicio" ? "edicio" : "lectura"}">Mode: ${
            state.accessMode === "edicio" ? "edició" : "lectura"
          }</span>
          <span class="source-badge source-${state.source}">${text(state.syncMessage)}</span>
          <button type="button" class="ghost-button compact-button" id="toggle-inventory">
            ${state.inventoryOpen ? "Tancar inventari" : "Inventari"}
          </button>
          <button type="button" class="ghost-button compact-button" id="toggle-people">
            ${state.peopleOpen ? "Tancar usuaris" : "Usuaris"}
          </button>
          ${
            isEditor()
              ? `<button type="button" class="ghost-button compact-button" id="toggle-admin-panel">
                  ${state.adminOpen ? "Tancar accessos" : "Accessos"}
                </button>`
              : ""
          }
          <button type="button" class="ghost-button compact-button" id="sign-out-button">Sortir</button>
        </div>
      </div>

      ${renderAdminPanel()}
      ${renderPeoplePanel()}
      ${
        state.adminOpen || state.peopleOpen
          ? ""
          : `${renderResults(results)}
             ${renderInventory()}
             ${computer ? renderComputerDetail(computer) : user ? renderUserDetail(user) : ""}`
      }
      ${footerMarkup()}
    </main>
    ${renderModal()}
    ${renderInstallPrompt()}
  `;

  bindMainEvents(results);
  bindInstallPromptEvents();
}

function bindMainEvents(results) {
  document.querySelector("#sign-out-button") && bindPress(document.querySelector("#sign-out-button"), signOut);
  document.querySelector("#toggle-admin-panel") && bindPress(document.querySelector("#toggle-admin-panel"), async () => {
    state.adminOpen = !state.adminOpen;
    state.peopleOpen = false;
    state.inventoryOpen = false;
    state.adminMessage = "";
    state.adminError = "";
    render();
    if (state.adminOpen && !state.adminUsers.length) await loadAdminUsers();
  });
  document.querySelector("#refresh-admin-users") && bindPress(document.querySelector("#refresh-admin-users"), loadAdminUsers);

  document.querySelector("#toggle-inventory") && bindPress(document.querySelector("#toggle-inventory"), () => {
    state.inventoryOpen = !state.inventoryOpen;
    state.adminOpen = false;
    state.peopleOpen = false;
    render();
  });
  document.querySelector("#toggle-people") && bindPress(document.querySelector("#toggle-people"), () => {
    state.peopleOpen = !state.peopleOpen;
    state.adminOpen = false;
    state.inventoryOpen = false;
    render();
  });
  document.querySelector("#people-search")?.addEventListener("input", (event) => {
    state.peopleQuery = event.target.value;
    if (inventoryRenderTimer) clearTimeout(inventoryRenderTimer);
    inventoryRenderTimer = setTimeout(() => {
      inventoryRenderTimer = null;
      render();
      const input = document.querySelector("#people-search");
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 140);
  });
  document.querySelectorAll("[data-people-open]").forEach((button) => {
    bindPress(button, () => {
      state.selectedResult = { type: "user", id: button.dataset.peopleOpen };
      state.peopleOpen = false;
      render();
      document.querySelector(".detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll("[data-people-edit]").forEach((button) => {
    bindPress(button, () => openUserEditor(button.dataset.peopleEdit));
  });
  document.querySelector("#people-new-user") && bindPress(document.querySelector("#people-new-user"), () => openCreator("user"));
  document.querySelector("#inventory-new-computer") &&
    bindPress(document.querySelector("#inventory-new-computer"), () => openCreator("computer"));
  document.querySelectorAll("[data-inventory-filter]").forEach((button) => {
    bindPress(button, () => {
      state.inventoryFilter = button.dataset.inventoryFilter;
      render();
    });
  });
  document.querySelector("#inventory-sort")?.addEventListener("change", (event) => {
    state.inventorySort = event.target.value;
    render();
  });
  document.querySelector("#inventory-search")?.addEventListener("input", (event) => {
    state.inventoryQuery = event.target.value;
    if (inventoryRenderTimer) clearTimeout(inventoryRenderTimer);
    inventoryRenderTimer = setTimeout(() => {
      inventoryRenderTimer = null;
      render();
      const input = document.querySelector("#inventory-search");
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 140);
  });
  document.querySelectorAll("[data-inventory-id]").forEach((button) => {
    bindPress(button, () => {
      state.selectedResult = { type: "computer", id: button.dataset.inventoryId };
      state.showActionPanel = false;
      render();
      document.querySelector(".detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelector("#search-input")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    if (!state.query.trim()) state.selectedResult = null;
    scheduleSearchRender();
  });
  document.querySelector("#search-input-mobile")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    if (!state.query.trim()) state.selectedResult = null;
  });
  document.querySelector("#search-input-mobile")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    render();
  });
  document.querySelector("#search-input-mobile")?.addEventListener("blur", () => {
    render();
  });

  document.querySelectorAll("[data-result-id]").forEach((button) => {
    bindPress(button, () => {
      state.selectedResult = { type: button.dataset.resultType, id: button.dataset.resultId };
      state.showActionPanel = false;
      render();
    });
  });

  if (state.adminOpen) {
    bindAdminEvents();
  }

  document.querySelectorAll("[data-action-id]").forEach((button) => {
    bindPress(button, () => {
      const computer = selectedComputer();
      const action = computer ? actionsForComputer(computer).find((item) => item.id === button.dataset.actionId) : null;
      if (!action || !computer) return;
      state.currentActionId = action.id;
      state.creatorOpen = false;
      state.editEventId = null;
      state.editUserId = null;
      state.formError = "";
      state.formData = {
        data: new Date().toISOString().slice(0, 10),
        usuariId: "",
        descripcio: action.defaultDescription ?? "",
        opcio: action.id === "reparat" ? "tornar" : "",
      };
      render();
    });
  });

  document.querySelector("#edit-computer-button") && bindPress(document.querySelector("#edit-computer-button"), () => {
    const computer = selectedComputer();
    if (!computer || !isEditor()) return;
    closeModals();
    state.editComputerId = computer.id;
    state.editComputerCode = computer.codi;
    render();
  });

  document.querySelector("#toggle-actions") && bindPress(document.querySelector("#toggle-actions"), () => {
    state.showActionPanel = !state.showActionPanel;
    render();
  });

  document.querySelector("#close-modal") && bindPress(document.querySelector("#close-modal"), () => {
    closeModals();
    render();
  });

  document.querySelector("#edit-user-button") && bindPress(document.querySelector("#edit-user-button"), () => {
    const user = selectedUser();
    if (user) openUserEditor(user.id);
  });

  document.querySelectorAll("[data-event-id]").forEach((button) => {
    bindPress(button, () => {
      if (state.accessMode !== "edicio") return;
      const event = state.events.find((item) => item.id === button.dataset.eventId);
      if (!event) return;
      state.editEventId = event.id;
      state.currentActionId = null;
      state.creatorOpen = false;
      state.editUserId = null;
      state.editEventData = {
        data: event.data,
        usuariId: event.usuariId ?? "",
        descripcio: event.descripcio ?? "",
      };
      render();
    });
  });

  if (state.creatorOpen) {
    document.querySelector("#create-computer-code")?.addEventListener("input", (event) => {
      state.createData.codi = event.target.value;
    });
    document.querySelector("#create-user-name")?.addEventListener("input", (event) => {
      state.createData.nom = event.target.value;
    });
    document.querySelector("#create-user-surname")?.addEventListener("input", (event) => {
      state.createData.cognoms = event.target.value;
    });
    document.querySelector("#create-user-type")?.addEventListener("change", (event) => {
      state.createData.tipusUsuari = event.target.value;
    });
    document.querySelector("#create-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await persistCreation();
    });
    return;
  }

  if (state.editEventId) {
    document.querySelector("#edit-event-date")?.addEventListener("input", (event) => {
      state.editEventData.data = event.target.value;
    });
    document.querySelector("#edit-event-user")?.addEventListener("change", (event) => {
      state.editEventData.usuariId = event.target.value;
    });
    document.querySelector("#edit-event-description")?.addEventListener("input", (event) => {
      state.editEventData.descripcio = event.target.value;
    });
    document.querySelector("#edit-event-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await persistEventEdit();
    });
    document.querySelector("#delete-event-button")?.addEventListener("click", async () => {
      await deleteEditedEvent();
    });
    return;
  }

  if (state.editUserId) {
    document.querySelector("#edit-user-name")?.addEventListener("input", (event) => {
      state.editUserData.nom = event.target.value;
    });
    document.querySelector("#edit-user-surname")?.addEventListener("input", (event) => {
      state.editUserData.cognoms = event.target.value;
    });
    document.querySelector("#edit-user-type")?.addEventListener("change", (event) => {
      state.editUserData.tipusUsuari = event.target.value;
    });
    document.querySelector("#edit-user-active")?.addEventListener("change", (event) => {
      state.editUserData.actiu = event.target.value === "true";
    });
    document.querySelector("#edit-user-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await persistUserEdit();
    });
    document.querySelector("#merge-target")?.addEventListener("change", (event) => {
      state.mergeTargetId = event.target.value;
      render();
    });
    document.querySelector("#merge-user-button")?.addEventListener("click", async () => {
      await removeEditedUser(state.mergeTargetId);
    });
    document.querySelector("#delete-user-button")?.addEventListener("click", async () => {
      await removeEditedUser(null);
    });
    return;
  }

  if (state.editComputerId) {
    document.querySelector("#edit-computer-code")?.addEventListener("input", (event) => {
      state.editComputerCode = event.target.value;
    });
    document.querySelector("#edit-computer-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await persistComputerEdit();
    });
    return;
  }

  const action = currentAction();
  const computer = selectedComputer();
  if (!action || !computer) return;

  document.querySelector("#event-date")?.addEventListener("input", (event) => {
    state.formData.data = event.target.value;
  });
  document.querySelector("#event-user")?.addEventListener("change", (event) => {
    state.formData.usuariId = event.target.value;
    state.formError = "";
    render();
  });
  document.querySelectorAll('input[name="event-option"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.formData.opcio = input.value;
    });
  });
  document.querySelector("#event-description")?.addEventListener("input", (event) => {
    state.formData.descripcio = event.target.value;
  });
  document.querySelector("#action-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (action.requiresUser && state.formData.usuariId === computer.usuariActualId) {
      state.formError = "L'equip ja està assignat a aquest usuari.";
      render();
      return;
    }
    await persistAction(actionOutcome(action, computer, state.formData), computer, state.formData.data, state.formData.descripcio);
  });
}

function closeModals() {
  state.currentActionId = null;
  state.creatorOpen = false;
  state.editEventId = null;
  state.editUserId = null;
  state.editComputerId = null;
  state.mergeTargetId = "";
}

function openCreator(kind) {
  if (!isEditor()) return;
  closeModals();
  state.creatorOpen = true;
  state.createData = { kind, codi: "", nom: "", cognoms: "", tipusUsuari: "alumne" };
  render();
}

function openUserEditor(userId) {
  const user = getUser(userId);
  if (!user || !isEditor()) return;
  closeModals();
  state.editUserId = user.id;
  state.editUserData = {
    nom: user.nom,
    cognoms: user.cognoms ?? "",
    tipusUsuari: user.tipusUsuari,
    actiu: user.actiu !== false,
  };
  render();
}

function bindAdminEvents() {
  document.querySelector("#admin-email")?.addEventListener("input", (event) => {
    state.adminForm.email = event.target.value;
  });
  document.querySelector("#admin-password")?.addEventListener("input", (event) => {
    state.adminForm.password = event.target.value;
  });
  document.querySelector("#admin-role")?.addEventListener("change", (event) => {
    state.adminForm.role = event.target.value;
  });
  document.querySelector("#admin-create-user-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createAdminUser();
  });
  document.querySelectorAll("[data-admin-role]").forEach((button) => {
    bindPress(button, async () => {
      await updateAdminUserRole(button.dataset.userId, button.dataset.adminRole);
    });
  });
  document.querySelectorAll("[data-admin-disable]").forEach((button) => {
    bindPress(button, async () => {
      const user = state.adminUsers.find((item) => item.id === button.dataset.userId);
      if (!user) return;
      await setAdminUserDisabled(user.id, !user.disabled);
    });
  });
  document.querySelectorAll("[data-admin-delete]").forEach((button) => {
    bindPress(button, async () => {
      const user = state.adminUsers.find((item) => item.id === button.dataset.userId);
      if (!user) return;
      const confirmed = window.confirm(`Vols eliminar l'accés de ${user.email}?`);
      if (!confirmed) return;
      await deleteAdminUser(user.id);
    });
  });
}

async function callUserAdmin(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke("manage-users", {
    body: { action, ...payload },
  });
  if (error) {
    if (error.context instanceof Response) {
      try {
        const body = await error.context.json();
        throw new Error(body.error ?? error.message);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== "Unexpected end of JSON input") throw parseError;
      }
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

async function loadAdminUsers() {
  state.isAdminLoading = true;
  state.adminError = "";
  state.adminMessage = "";
  render();

  try {
    const data = await callUserAdmin("list");
    state.adminUsers = data.users ?? [];
    state.adminMessage = "Llista d'accessos actualitzada.";
  } catch (error) {
    state.adminError = error.message ?? "No s'han pogut carregar els accessos.";
  } finally {
    state.isAdminLoading = false;
    render();
  }
}

async function createAdminUser() {
  state.isAdminLoading = true;
  state.adminError = "";
  state.adminMessage = "";
  render();

  try {
    await callUserAdmin("create", {
      email: state.adminForm.email.trim(),
      password: state.adminForm.password,
      role: state.adminForm.role,
    });
    state.adminForm = { email: "", password: "", role: "consulta" };
    state.adminMessage = "Accés creat correctament.";
    const data = await callUserAdmin("list");
    state.adminUsers = data.users ?? [];
  } catch (error) {
    state.adminError = error.message ?? "No s'ha pogut crear l'accés.";
  } finally {
    state.isAdminLoading = false;
    render();
  }
}

async function updateAdminUserRole(userId, role) {
  state.isAdminLoading = true;
  state.adminError = "";
  state.adminMessage = "";
  render();

  try {
    await callUserAdmin("update-role", { userId, role });
    state.adminMessage = "Rol actualitzat.";
    const data = await callUserAdmin("list");
    state.adminUsers = data.users ?? [];
  } catch (error) {
    state.adminError = error.message ?? "No s'ha pogut actualitzar el rol.";
  } finally {
    state.isAdminLoading = false;
    render();
  }
}

async function setAdminUserDisabled(userId, disabled) {
  state.isAdminLoading = true;
  state.adminError = "";
  state.adminMessage = "";
  render();

  try {
    await callUserAdmin("set-disabled", { userId, disabled });
    state.adminMessage = disabled ? "Accés desactivat." : "Accés reactivat.";
    const data = await callUserAdmin("list");
    state.adminUsers = data.users ?? [];
  } catch (error) {
    state.adminError = error.message ?? "No s'ha pogut canviar l'estat de l'accés.";
  } finally {
    state.isAdminLoading = false;
    render();
  }
}

async function deleteAdminUser(userId) {
  state.isAdminLoading = true;
  state.adminError = "";
  state.adminMessage = "";
  render();

  try {
    await callUserAdmin("delete", { userId });
    state.adminUsers = state.adminUsers.filter((user) => user.id !== userId);
    state.adminMessage = "Accés eliminat.";
  } catch (error) {
    state.adminError = error.message ?? "No s'ha pogut eliminar l'accés.";
  } finally {
    state.isAdminLoading = false;
    render();
  }
}

async function loadSupabaseData() {
  state.syncMessage = "Carregant dades...";
  try {
    const [usersResult, computersResult, eventsResult, assignmentsResult] = await Promise.all([
      supabase.from("usuaris").select("id, nom, cognoms, tipus_usuari, actiu").order("nom"),
      supabase.from("ordinadors").select("id, codi_rppo, estat_actual, usuari_actual_id, observacions_generals").order("codi_rppo"),
      supabase.from("esdeveniments").select("id, ordinador_id, usuari_id, tipus, data_event, descripcio, curs_academic").order("data_event", { ascending: false }),
      supabase.from("assignacions").select("id, ordinador_id, usuari_id, data_inici, data_final, curs_academic, motiu"),
    ]);

    if (usersResult.error || computersResult.error || eventsResult.error || assignmentsResult.error) {
      throw usersResult.error || computersResult.error || eventsResult.error || assignmentsResult.error;
    }

    state.users = usersResult.data.map((item) => ({
      id: item.id,
      nom: item.nom,
      cognoms: item.cognoms ?? "",
      tipusUsuari: item.tipus_usuari,
      actiu: item.actiu !== false,
    }));
    state.computers = computersResult.data.map((item) => ({
      id: item.id,
      codi: item.codi_rppo,
      estat: normalizeComputerStatus(item.estat_actual, item.usuari_actual_id),
      usuariActualId: item.usuari_actual_id,
      observacions: item.observacions_generals ?? "",
    }));
    state.events = eventsResult.data.map((item) => ({
      id: item.id,
      ordinadorId: item.ordinador_id,
      usuariId: item.usuari_id,
      tipus: item.tipus,
      data: item.data_event,
      descripcio: item.descripcio,
      cursAcademic: item.curs_academic,
    }));
    state.assignments = assignmentsResult.data.map((item) => ({
      id: item.id,
      ordinadorId: item.ordinador_id,
      usuariId: item.usuari_id,
      dataInici: item.data_inici,
      dataFinal: item.data_final,
      cursAcademic: item.curs_academic,
      motiu: item.motiu,
    }));
    state.source = "supabase";
    state.syncMessage = "Dades de Supabase";
  } catch (error) {
    console.error(error);
    state.source = "local";
    state.syncMessage = `Mode local: ${supabaseErrorMessage(error)}`;
  }
  render();
}

async function persistAction(outcome, computer, eventDate, description) {
  state.isSaving = true;
  state.syncMessage = "Desant a Supabase...";
  render();

  const current = activeAssignment(computer.id);
  const { eventType, nextState, nextUserId } = outcome;
  const nextObservations = eventType === "observacio" ? description : computer.observacions;

  try {
    if (eventType === "assignacio" || eventType === "canvi_propietari") {
      if (current) {
        const { error } = await supabase
          .from("assignacions")
          .update({
            data_final: eventDate,
            motiu: "Tancada per canvi de propietari",
          })
          .eq("id", current.id);
        if (error) throw error;
      }

      const { error } = await supabase.from("assignacions").insert({
        id: makeId(),
        ordinador_id: computer.id,
        usuari_id: nextUserId,
        data_inici: eventDate,
        data_final: null,
        curs_academic: academicYear(eventDate),
        motiu: outcome.label,
      });
      if (error) throw error;
    } else if (outcome.closesAssignment && current) {
      const { error } = await supabase
        .from("assignacions")
        .update({
          data_final: eventDate,
          motiu: outcome.label,
        })
        .eq("id", current.id);
      if (error) throw error;
    }

    const { error: computerError } = await supabase
      .from("ordinadors")
      .update({
        estat_actual: nextState,
        usuari_actual_id: nextUserId,
        observacions_generals: nextObservations,
      })
      .eq("id", computer.id);
    if (computerError) throw computerError;

    const { error: eventError } = await supabase.from("esdeveniments").insert({
      id: makeId(),
      ordinador_id: computer.id,
      usuari_id: nextUserId ?? computer.usuariActualId,
      tipus: eventType,
      data_event: eventDate,
      descripcio: description,
      estat_resultant: nextState,
      curs_academic: academicYear(eventDate),
    });
    if (eventError) throw eventError;

    state.currentActionId = null;
    state.creatorOpen = false;
    state.editEventId = null;
    state.syncMessage = "Canvis desats a Supabase";
    await loadSupabaseData();
  } catch (error) {
    console.error(error);
    state.syncMessage = `Error en desar: ${error.message ?? "revisa permisos o connexió"}`;
    state.isSaving = false;
    render();
    return;
  }

  state.isSaving = false;
  render();
}

async function persistCreation() {
  state.isSaving = true;
  state.syncMessage = "Desant a Supabase...";
  render();

  try {
    if (state.createData.kind === "computer") {
      const codi = normalizeComputerCode(state.createData.codi);
      if (!codi.startsWith("RPPO")) throw new Error("El codi ha de començar per RPPO.");

      const { error } = await supabase.from("ordinadors").insert({
        id: makeId(),
        codi_rppo: codi,
        estat_actual: "lliure",
        usuari_actual_id: null,
        observacions_generals: "",
      });
      if (error) throw error;
    } else {
      const nom = state.createData.nom.trim();
      if (!nom) throw new Error("Cal indicar el nom de l'usuari.");

      const { error } = await supabase.from("usuaris").insert({
        id: makeId(),
        nom,
        cognoms: state.createData.cognoms.trim(),
        tipus_usuari: state.createData.tipusUsuari,
        actiu: true,
      });
      if (error) throw error;
    }

    state.creatorOpen = false;
    state.syncMessage = "Canvis desats a Supabase";
    await loadSupabaseData();
  } catch (error) {
    console.error(error);
    state.syncMessage = `Error en desar: ${error.message ?? "revisa permisos o connexió"}`;
    state.isSaving = false;
    render();
    return;
  }

  state.isSaving = false;
  render();
}

async function persistEventEdit() {
  const event = currentEditedEvent();
  if (!event) return;

  state.isSaving = true;
  state.syncMessage = "Desant a Supabase...";
  render();

  try {
    const { error } = await supabase
      .from("esdeveniments")
      .update({
        usuari_id: state.editEventData.usuariId || null,
        data_event: state.editEventData.data,
        descripcio: state.editEventData.descripcio.trim(),
        curs_academic: academicYear(state.editEventData.data),
      })
      .eq("id", event.id);

    if (error) throw error;

    state.editEventId = null;
    state.syncMessage = "Canvis desats a Supabase";
    await loadSupabaseData();
  } catch (error) {
    console.error(error);
    state.syncMessage = `Error en desar: ${error.message ?? "revisa permisos o connexió"}`;
    state.isSaving = false;
    render();
    return;
  }

  state.isSaving = false;
  render();
}

async function persistUserEdit() {
  const user = currentEditedUser();
  if (!user) return;

  state.isSaving = true;
  state.syncMessage = "Desant a Supabase...";
  render();

  try {
    const nom = state.editUserData.nom.trim();
    if (!nom) throw new Error("Cal indicar el nom de l'usuari.");

    const { error } = await supabase
      .from("usuaris")
      .update({
        nom,
        cognoms: state.editUserData.cognoms.trim(),
        tipus_usuari: state.editUserData.tipusUsuari,
        actiu: state.editUserData.actiu,
      })
      .eq("id", user.id);

    if (error) throw error;

    state.editUserId = null;
    state.syncMessage = "Usuari desat a Supabase";
    await loadSupabaseData();
  } catch (error) {
    console.error(error);
    state.syncMessage = `Error en desar: ${error.message ?? "revisa permisos o connexió"}`;
    state.isSaving = false;
    render();
    return;
  }

  state.isSaving = false;
  render();
}

async function persistComputerEdit() {
  const computer = state.computers.find((item) => item.id === state.editComputerId);
  if (!computer) return;

  state.isSaving = true;
  state.syncMessage = "Desant a Supabase...";
  render();

  try {
    const codi = normalizeComputerCode(state.editComputerCode);
    if (!codi.startsWith("RPPO")) throw new Error("El codi ha de començar per RPPO.");
    if (state.computers.some((item) => item.id !== computer.id && item.codi === codi)) {
      throw new Error(`Ja hi ha un equip amb el codi ${codi}.`);
    }

    const { error } = await supabase.from("ordinadors").update({ codi_rppo: codi }).eq("id", computer.id);
    if (error) throw error;

    state.editComputerId = null;
    state.syncMessage = "Equip desat a Supabase";
    await loadSupabaseData();
  } catch (error) {
    console.error(error);
    state.syncMessage = `Error en desar: ${error.message ?? "revisa permisos o connexió"}`;
    state.isSaving = false;
    render();
    return;
  }

  state.isSaving = false;
  render();
}

// Sense destinació esborra un usuari sense historial; amb destinació hi fusiona l'usuari editat.
async function removeEditedUser(targetId) {
  const user = currentEditedUser();
  if (!user) return;

  const target = targetId ? getUser(targetId) : null;
  if (targetId && !target) return;
  const confirmed = window.confirm(
    target
      ? `L'historial i els equips de ${userName(user.id)} passaran a ${userName(target.id)}, i ${userName(user.id)} s'esborrarà. Vols continuar?`
      : `Vols esborrar definitivament ${userName(user.id)}?`,
  );
  if (!confirmed) return;

  state.isSaving = true;
  state.syncMessage = target ? "Fusionant usuaris..." : "Esborrant usuari...";
  render();

  try {
    const { error } = await supabase.rpc("elimina_usuari", { p_origen: user.id, p_desti: target?.id ?? null });
    if (error) throw error;

    closeModals();
    if (state.selectedResult?.type === "user" && state.selectedResult.id === user.id) {
      state.selectedResult = target ? { type: "user", id: target.id } : null;
    }
    state.syncMessage = target ? "Usuaris fusionats" : "Usuari esborrat";
    await loadSupabaseData();
  } catch (error) {
    console.error(error);
    state.syncMessage = `Error: ${error.message ?? "revisa permisos o connexió"}`;
    state.isSaving = false;
    render();
    return;
  }

  state.isSaving = false;
  render();
}

async function deleteEditedEvent() {
  const event = currentEditedEvent();
  if (!event) return;

  const confirmed = window.confirm(
    isStructuralEventType(event.tipus)
      ? "Aquest esdeveniment afecta la traçabilitat de l'equip i s'eliminarà definitivament. Vols continuar?"
      : "Vols eliminar definitivament aquest esdeveniment?",
  );
  if (!confirmed) return;

  state.isSaving = true;
  state.syncMessage = "Eliminant esdeveniment...";
  render();

  try {
    const { error } = await supabase.from("esdeveniments").delete().eq("id", event.id);

    if (error) throw error;

    state.editEventId = null;
    state.syncMessage = "Esdeveniment eliminat";
    await loadSupabaseData();
  } catch (error) {
    console.error(error);
    state.syncMessage = `Error en eliminar: ${error.message ?? "revisa permisos o connexió"}`;
    state.isSaving = false;
    render();
    return;
  }

  state.isSaving = false;
  render();
}

function render() {
  if (!state.accessMode) renderAuthAccess();
  else renderMain();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("No s'ha pogut registrar el service worker.", error);
    });
  });
}

syncInstalledMobileClass();
window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change", syncInstalledMobileClass);
window.matchMedia?.("(max-width: 820px) and (pointer: coarse)")?.addEventListener?.("change", syncInstalledMobileClass);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPromptEvent = event;
  if (shouldShowInstallPrompt()) {
    state.installPromptVisible = true;
    render();
  }
});

window.addEventListener("appinstalled", () => {
  deferredInstallPromptEvent = null;
  state.installPromptVisible = false;
  markInstallPromptSeen();
  render();
});

if (shouldShowInstallPrompt()) {
  state.installPromptVisible = true;
}

render();
restoreSession();
