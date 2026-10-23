/* Equips — repartiment equilibrat a l'atzar, amb noms d'equip i rols cooperatius. */
(() => {
  "use strict";
  const A = window.Atzar,
    $ = A.$;
  const KEY = "felip.atzar.equips.v1",
    DURATIONS = [0, 2500, 5000];
  const DEFAULTS = ["Anna", "Biel", "Clàudia", "David", "Emma", "Guillem", "Júlia", "Marc", "Nil", "Ona", "Pau", "Queralt", "Roc", "Sara", "Teo", "Valèria"];
  const DEFAULT_ROLES = "Coordinador/a, Secretari/ària, Portaveu, Material";
  const COLORS = ["#d47761", "#5f91a6", "#759479", "#e2ad55", "#817ca6", "#c78294", "#519b92", "#ac975d"];
  const NAME_SETS = {
    colors: ["Vermell", "Blau", "Verd", "Groc", "Lila", "Rosa", "Turquesa", "Ocre", "Taronja", "Gris", "Marró", "Blanc"],
    animals: ["Àligues", "Balenes", "Cérvols", "Dofins", "Elefants", "Falcons", "Girafes", "Guineus", "Linxs", "Llops", "Óssos", "Pingüins", "Tigres", "Tortugues", "Zebres", "Mussols"],
  };
  // Els colors d'equip coincideixen amb el nom quan l'estil és «Colors».
  const COLOR_HEX = ["#d0584a", "#4f86b0", "#5f9767", "#e2b13c", "#8a74b8", "#d47c9b", "#3ea6a0", "#b8913f", "#e08a3c", "#8d969a", "#93684a", "#c9c3b0"];
  const valid = (a) => Array.isArray(a) && a.length <= 200 && a.every((x) => typeof x === "string" && x.trim() && x.length <= 80);
  const state = {
    base: [...DEFAULTS],
    split: "teams",
    teams: 4,
    size: 4,
    names: "numbers",
    customNames: "",
    roles: false,
    rolesList: DEFAULT_ROLES,
    title: "",
    duration: 2500,
    last: null,
    history: [],
  };
  const saved = A.load(KEY, null);
  if (saved && typeof saved === "object" && valid(saved.base)) {
    state.base = saved.base;
    if (["teams", "size"].includes(saved.split)) state.split = saved.split;
    for (const k of ["teams", "size"]) if (Number.isInteger(saved[k])) state[k] = Math.max(1, Math.min(100, saved[k]));
    if (["numbers", "colors", "animals", "custom"].includes(saved.names)) state.names = saved.names;
    for (const k of ["customNames", "rolesList", "title"]) if (typeof saved[k] === "string") state[k] = saved[k].slice(0, 400);
    if (typeof saved.roles === "boolean") state.roles = saved.roles;
    if (DURATIONS.includes(saved.duration)) state.duration = saved.duration;
    if (saved.last && Array.isArray(saved.last.teams)) state.last = saved.last;
    if (Array.isArray(saved.history)) state.history = saved.history.filter((h) => h && typeof h.label === "string" && Number.isFinite(h.time)).slice(0, 200);
  }
  const persist = () => A.save(KEY, state);
  let busy = false,
    inputTimer;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const splitList = (s) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 40);

  function teamCount(n = state.base.length) {
    if (!n) return 0;
    return state.split === "teams" ? Math.min(state.teams, n) : Math.ceil(n / Math.min(state.size, n));
  }
  function teamName(i) {
    if (state.names === "custom") {
      const list = splitList(state.customNames);
      if (list[i]) return list[i].slice(0, 40);
    }
    const set = NAME_SETS[state.names];
    if (set) return set[i % set.length] + (i >= set.length ? ` ${Math.floor(i / set.length) + 1}` : "");
    return `Equip ${i + 1}`;
  }
  function teamColor(i) {
    return state.names === "colors" ? COLOR_HEX[i % COLOR_HEX.length] : COLORS[i % COLORS.length];
  }

  function layout() {
    const host = $("teams"),
      k = state.last?.teams.length || 0;
    if (!k) return;
    const W = host.clientWidth || 320,
      H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--play-height")) || 360,
      narrow = W < 600,
      per = Math.max(...state.last.teams.map((t) => t.members.length));
    let cols = narrow ? (k > 1 && W > 340 ? 2 : 1) : Math.max(1, Math.min(k, Math.round(Math.sqrt((k * W) / H / 0.9))));
    if (narrow && per > 6) cols = 1;
    const rows = Math.ceil(k / cols),
      byHeight = (H - (rows - 1) * 12) / rows / (per * 1.95 + 3.6),
      byWidth = (W / cols - 30) / 13;
    const font = narrow ? 15 : Math.max(11, Math.min(24, byHeight, byWidth));
    host.style.setProperty("--team-cols", cols);
    host.style.setProperty("--team-font", `${font.toFixed(1)}px`);
  }
  function teamCard(team, i) {
    const card = document.createElement("article"),
      h3 = document.createElement("h3"),
      count = document.createElement("small"),
      ul = document.createElement("ul");
    card.className = "team";
    card.style.setProperty("--t", team.color || teamColor(i));
    h3.textContent = team.name;
    count.textContent = team.members.length;
    h3.append(count);
    card.append(h3, ul);
    return card;
  }
  function memberItem(m, isNew) {
    const li = document.createElement("li"),
      name = document.createElement("span");
    name.textContent = m.name;
    li.append(name);
    if (m.role) {
      const role = document.createElement("span");
      role.className = "role";
      role.textContent = m.role;
      li.append(role);
    }
    if (isNew) li.classList.add("new");
    return li;
  }
  function renderTeams() {
    const host = $("teams");
    if (!state.last) return host.replaceChildren();
    host.replaceChildren(
      ...state.last.teams.map((team, i) => {
        const card = teamCard(team, i);
        card.querySelector("ul").append(...team.members.map((m) => memberItem(m)));
        return card;
      }),
    );
    layout();
  }

  async function make() {
    const n = state.base.length;
    if (busy) return;
    if (n < 2) return A.toast("Calen almenys dues persones.");
    A.audioReady();
    busy = true;
    sync();
    const k = teamCount(),
      order = A.shuffle(state.base),
      roles = state.roles ? splitList(state.rolesList) : [];
    const teams = Array.from({ length: k }, (_, i) => ({ name: teamName(i), color: teamColor(i), members: [] }));
    order.forEach((name, i) => teams[i % k].members.push({ name }));
    for (const t of teams) t.members.forEach((m, j) => roles[j] && (m.role = roles[j]));
    state.last = { teams, time: Date.now() };
    // Repartiment visual: un nom cada vegada, per torns, com qui reparteix cartes.
    const host = $("teams");
    const cards = teams.map((t, i) => teamCard({ ...t, members: [] }, i));
    host.replaceChildren(...cards);
    layout();
    const delay = A.reduced.matches ? 0 : state.duration / n;
    const filled = teams.map(() => 0);
    for (let i = 0; i < n; i++) {
      const t = i % k,
        member = teams[t].members[filled[t]++];
      cards[t].querySelector("ul").append(memberItem(member, delay > 0));
      cards[t].querySelector("small").textContent = filled[t];
      if (delay) {
        A.tone(520 + (t % 8) * 60, 0.05, 0, "triangle", 0.12);
        await wait(delay);
      }
    }
    busy = false;
    const label = `${k} equips · ${teams.map((t) => `${t.name}: ${t.members.map((m) => m.name).join(", ")}`).join(" · ")}`;
    state.history.unshift({ label: label.length > 400 ? `${label.slice(0, 397)}…` : label, time: Date.now() });
    state.history.length = Math.min(state.history.length, 200);
    $("resultLine").textContent = label;
    A.sounds.win();
    persist();
    sync();
    renderHistory();
  }

  function asText() {
    return state.last.teams.map((t) => `${t.name}\n${t.members.map((m) => `  · ${m.name}${m.role ? ` (${m.role})` : ""}`).join("\n")}`).join("\n\n");
  }
  function sync() {
    const n = state.base.length,
      k = teamCount(),
      isTeams = state.split === "teams",
      value = isTeams ? state.teams : state.size;
    $("entryCount").textContent = n;
    $("stageTitle").textContent = state.title || "Fem equips!";
    $("titleInput").value = state.title;
    for (const b of document.querySelectorAll("[data-split]")) b.setAttribute("aria-pressed", String(b.dataset.split === state.split));
    $("sizeLabel").textContent = isTeams ? "Equips" : "Persones per equip";
    $("sizeValue").textContent = value;
    $("sizeMinus").disabled = value <= (isTeams ? 2 : 2);
    $("sizePlus").disabled = value >= Math.max(2, isTeams ? Math.min(n, 30) : Math.min(n, 30));
    if (n >= 2) {
      const small = Math.floor(n / k),
        big = Math.ceil(n / k),
        bigCount = n % k;
      $("splitNote").textContent =
        small === big ? `${k} equips de ${small} persones.` : `${k} equips: ${bigCount} de ${big} i ${k - bigCount} de ${small} persones.`;
      $("stageSubtitle").textContent = `${n} persones · ${k} equips`;
    } else {
      $("splitNote").textContent = "Escriu almenys dues persones.";
      $("stageSubtitle").textContent = "";
    }
    $("namesInput").value = state.names;
    $("customNamesField").hidden = state.names !== "custom";
    $("customNames").value = state.customNames;
    $("rolesToggle").checked = state.roles;
    $("rolesField").hidden = $("rolesDefault").hidden = !state.roles;
    $("rolesInput").value = state.rolesList;
    $("durationInput").value = String(state.duration);
    $("makeButton").disabled = busy || n < 2;
    $("makeLabel").textContent = state.last ? "Torna a fer equips" : "Fes equips";
    $("copyButton").disabled = busy || !state.last;
    $("exportHistory").disabled = !state.last;
    $("entriesInput").disabled = busy;
    const dup = n - new Set(state.base.map((x) => x.toLowerCase())).size;
    $("entryFeedback").textContent = dup ? `Hi ha ${dup} ${dup === 1 ? "nom repetit" : "noms repetits"}. Afegeix-hi una inicial per distingir-los.` : "";
  }
  function renderHistory() {
    A.renderHistory($("historyList"), $("historyEmpty"), state.history, $("historyCount"));
    $("clearHistory").disabled = !state.history.length;
  }
  function setBase(entries) {
    state.base = entries;
    persist();
    sync();
  }

  $("makeButton").addEventListener("click", make);
  $("entriesInput").addEventListener("input", (e) => {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => setBase(A.parseLines(e.target.value)), 250);
  });
  for (const b of document.querySelectorAll("[data-split]"))
    b.addEventListener("click", () => {
      state.split = b.dataset.split;
      persist();
      sync();
    });
  function step(delta) {
    const key = state.split === "teams" ? "teams" : "size";
    state[key] = Math.max(2, Math.min(30, state[key] + delta));
    persist();
    sync();
  }
  $("sizeMinus").addEventListener("click", () => step(-1));
  $("sizePlus").addEventListener("click", () => step(1));
  $("namesInput").addEventListener("change", (e) => {
    state.names = e.target.value;
    persist();
    sync();
  });
  $("customNames").addEventListener("input", (e) => {
    state.customNames = e.target.value.slice(0, 400);
    persist();
  });
  $("rolesToggle").addEventListener("change", (e) => {
    state.roles = e.target.checked;
    persist();
    sync();
  });
  $("rolesInput").addEventListener("input", (e) => {
    state.rolesList = e.target.value.slice(0, 400);
    persist();
  });
  $("rolesDefault").addEventListener("click", () => {
    state.rolesList = DEFAULT_ROLES;
    persist();
    sync();
  });
  $("titleInput").addEventListener("input", (e) => {
    state.title = e.target.value.slice(0, 70);
    persist();
    sync();
  });
  $("durationInput").addEventListener("change", (e) => {
    state.duration = Number(e.target.value);
    persist();
  });
  $("copyButton").addEventListener("click", () => A.copyText(asText()));
  $("clearHistory").addEventListener("click", () => {
    state.history = [];
    persist();
    renderHistory();
  });
  $("exportHistory").addEventListener("click", () =>
    A.downloadCsv("equips.csv", [["Equip", "Persona", "Rol"], ...state.last.teams.flatMap((t) => t.members.map((m) => [t.name, m.name, m.role || ""]))]),
  );
  A.setupClasses({
    getEntries: () => state.base,
    onLoad: (group) => {
      $("entriesInput").value = group.entries.join("\n");
      setBase([...group.entries]);
    },
  });
  document.addEventListener("atzar:fit", layout);

  A.init({ onAction: make, isBusy: () => busy, fit: { min: 280, max: 560 } });
  $("entriesInput").value = state.base.join("\n");
  renderTeams();
  sync();
  renderHistory();
})();
