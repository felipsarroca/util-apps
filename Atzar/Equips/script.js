/* Equips — repartiment equilibrat a l'atzar, amb condicions, nivells, rols i retoc manual. */
(() => {
  "use strict";
  const A = window.Atzar,
    $ = A.$;
  const KEY = "felip.atzar.equips.v1",
    DURATIONS = [0, 2500, 5000];
  const DEFAULTS = ["Anna", "Biel", "Clàudia", "David", "Emma", "Guillem", "Júlia", "Marc", "Nil", "Ona", "Pau", "Queralt", "Roc", "Sara", "Teo", "Valèria"];
  const DEFAULT_ROLES = "Coordinador/a, Secretari/ària, Portaveu, Material";
  // Descripcions per a la targeta de rols que es projecta a l'inici de la sessió.
  const ROLE_INFO = {
    "coordinador/a": "Vetlla perquè tothom participi, reparteix la feina i fa avançar l’equip segons el pla.",
    "secretari/ària": "Pren nota dels acords i de la feina feta, i omple el diari o el pla de l’equip.",
    portaveu: "Parla en nom de l’equip, pregunta els dubtes al docent i explica les conclusions a la classe.",
    material: "Recull, reparteix i té cura del material, i s’assegura que tot queda endreçat.",
  };
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
    leftover: "smaller",
    names: "numbers",
    customNames: "",
    roles: false,
    rolesList: DEFAULT_ROLES,
    rules: [],
    balance: false,
    levels: {},
    title: "",
    duration: 2500,
    last: null,
    history: [],
  };
  const saved = A.load(KEY, null);
  if (saved && typeof saved === "object" && valid(saved.base)) {
    state.base = saved.base;
    if (["teams", "size"].includes(saved.split)) state.split = saved.split;
    for (const k of ["teams", "size"]) if (Number.isInteger(saved[k])) state[k] = Math.max(2, Math.min(30, saved[k]));
    if (["smaller", "spread"].includes(saved.leftover)) state.leftover = saved.leftover;
    if (["numbers", "colors", "animals", "custom"].includes(saved.names)) state.names = saved.names;
    for (const k of ["customNames", "rolesList", "title"]) if (typeof saved[k] === "string") state[k] = saved[k].slice(0, 400);
    for (const k of ["roles", "balance"]) if (typeof saved[k] === "boolean") state[k] = saved[k];
    if (Array.isArray(saved.rules))
      state.rules = saved.rules.filter((r) => r && typeof r.a === "string" && typeof r.b === "string" && r.a !== r.b && ["apart", "together"].includes(r.type)).slice(0, 60);
    if (saved.levels && typeof saved.levels === "object")
      for (const [name, v] of Object.entries(saved.levels)) if ([1, 2, 3].includes(v)) state.levels[name] = v;
    if (DURATIONS.includes(saved.duration)) state.duration = saved.duration;
    if (saved.last && Array.isArray(saved.last.teams))
      state.last = {
        time: Number.isFinite(saved.last.time) ? saved.last.time : Date.now(),
        teams: saved.last.teams
          .filter((t) => t && typeof t.name === "string" && Array.isArray(t.members))
          .map((t) => ({
            name: t.name,
            color: typeof t.color === "string" ? t.color : "",
            members: t.members.filter((m) => m && typeof m.name === "string").map((m) => ({ name: m.name, role: typeof m.role === "string" ? m.role : "", pinned: m.pinned === true })),
          })),
      };
    if (Array.isArray(saved.history)) state.history = saved.history.filter((h) => h && typeof h.label === "string" && Number.isFinite(h.time)).slice(0, 200);
  }
  const persist = () => A.save(KEY, state);
  let busy = false,
    inputTimer,
    selected = null; // {t, m}: membre seleccionat per moure'l o intercanviar-lo
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const splitList = (s) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 40);
  const people = () => state.base;
  const level = (name) => state.levels[name] || 2;

  function teamCount(n = people().length) {
    if (!n) return 0;
    if (state.split === "teams") return Math.min(state.teams, n);
    const size = Math.min(state.size, n);
    return state.leftover === "spread" ? Math.max(1, Math.floor(n / size)) : Math.ceil(n / size);
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

  /* Repartiment amb condicions.
     Les persones que han d'anar juntes formen una unitat; les fixades conserven l'equip.
     Es fan diversos intents a l'atzar i es queda el primer que compleix totes les condicions. */
  function plan(names, k) {
    const n = names.length,
      inList = new Set(names);
    const parent = new Map(names.map((x) => [x, x]));
    const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
    for (const r of state.rules) if (r.type === "together" && inList.has(r.a) && inList.has(r.b)) parent.set(find(r.a), find(r.b));
    const apart = state.rules.filter((r) => r.type === "apart" && inList.has(r.a) && inList.has(r.b));
    const fixed = new Map();
    if (state.last)
      state.last.teams.forEach((t, i) => {
        if (i < k) for (const m of t.members) if (m.pinned && inList.has(m.name) && !fixed.has(find(m.name))) fixed.set(find(m.name), i);
      });
    const groups = new Map();
    for (const x of names) {
      const root = find(x);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(x);
    }
    const units = [...groups.entries()].map(([root, members]) => ({ members, fixed: fixed.get(root), level: Math.max(...members.map(level)) }));
    const clash = (team, unit) => apart.filter((r) => (team.includes(r.a) && unit.members.includes(r.b)) || (team.includes(r.b) && unit.members.includes(r.a))).length;
    let best = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      // Les mides (unes poden tenir una persona més) també es reparteixen a l'atzar.
      const cap = A.shuffle(Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0)));
      const teams = Array.from({ length: k }, () => []),
        levels = Array.from({ length: k }, () => [0, 0, 0, 0]);
      let order = A.shuffle(units);
      // Primer les unitats fixades, després les grans i, si cal equilibrar, de nivell alt a baix.
      order.sort((a, b) => (b.fixed !== undefined) - (a.fixed !== undefined) || b.members.length - a.members.length || (state.balance ? b.level - a.level : 0));
      let bad = 0;
      for (const unit of order) {
        let target = unit.fixed;
        if (target === undefined) {
          let bestScore = Infinity;
          for (const i of A.shuffle([...teams.keys()])) {
            const room = cap[i] - teams[i].length - unit.members.length;
            const score = (room < 0 ? 1e6 * -room : 0) + clash(teams[i], unit) * 1e4 + (state.balance ? levels[i][unit.level] * 100 + levels[i].reduce((a, b, j) => a + b * j, 0) : 0) - room;
            if (score < bestScore) [bestScore, target] = [score, i];
          }
        }
        bad += clash(teams[target], unit) + Math.max(0, teams[target].length + unit.members.length - cap[target]);
        teams[target].push(...unit.members);
        for (const m of unit.members) levels[target][level(m)]++;
      }
      if (!best || bad < best.bad) best = { teams, bad };
      if (!bad) break;
    }
    return best;
  }

  function layout() {
    const host = $("teams"),
      k = state.last?.teams.length || 0;
    if (!k) return;
    const W = host.clientWidth || 320,
      H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--play-height")) || 360,
      narrow = W < 600,
      per = Math.max(1, ...state.last.teams.map((t) => t.members.length));
    // Es busca la graella on la lletra és més gran i, a igualtat, la que no deixa files a mig omplir.
    let cols = 1,
      font = 0;
    if (narrow) cols = k > 1 && W > 340 && per <= 6 ? 2 : 1;
    else
      for (let c = 1; c <= k; c++) {
        const rows = Math.ceil(k / c),
          f = Math.min(24, (H - (rows - 1) * 12) / rows / (per * 1.95 + 3.6), (W / c - 30) / 13),
          gaps = rows * c - k;
        if (f - gaps * 0.6 > font) [font, cols] = [f - gaps * 0.6, c];
      }
    const rows = Math.ceil(k / cols),
      size = narrow ? 15 : Math.max(11, Math.min(24, (H - (rows - 1) * 12) / rows / (per * 1.95 + 3.6), (W / cols - 30) / 13));
    host.style.setProperty("--team-cols", cols);
    host.style.setProperty("--team-font", `${size.toFixed(1)}px`);
  }
  function teamCard(team, i) {
    const card = document.createElement("article"),
      h3 = document.createElement("h3"),
      title = document.createElement("span"),
      count = document.createElement("small"),
      ul = document.createElement("ul");
    card.className = "team";
    card.dataset.team = i;
    card.style.setProperty("--t", team.color || teamColor(i));
    title.textContent = team.name;
    count.textContent = team.members.length;
    h3.append(title, count);
    card.append(h3, ul);
    return card;
  }
  function memberItem(m, isNew, t, j) {
    const li = document.createElement("li"),
      name = document.createElement("button");
    name.type = "button";
    name.className = "member";
    name.textContent = m.name;
    if (t !== undefined) {
      name.dataset.team = t;
      name.dataset.member = j;
    }
    if (m.pinned) {
      name.classList.add("pinned");
      name.title = "Fixat: es queda en aquest equip quan tornis a fer equips";
    }
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
        card.querySelector("ul").append(...team.members.map((m, j) => memberItem(m, false, i, j)));
        return card;
      }),
    );
    if (selected) host.querySelector(`[data-team="${selected.t}"][data-member="${selected.m}"]`)?.classList.add("selected");
    host.classList.toggle("editing", !!selected);
    layout();
  }
  function assignRoles(team) {
    const roles = state.roles ? splitList(state.rolesList) : [];
    team.members.forEach((m, j) => (m.role = roles[j] || ""));
  }

  async function make() {
    const list = people(),
      n = list.length;
    if (busy) return;
    if (n < 2) return A.toast("Calen almenys dues persones presents.");
    A.audioReady();
    selected = null;
    busy = true;
    sync();
    const k = teamCount(),
      result = plan(list, k);
    const teams = result.teams.map((members, i) => {
      const pinned = new Set(state.last?.teams[i]?.members.filter((m) => m.pinned).map((m) => m.name) || []);
      // Les persones fixades conserven la posició (i el rol); la resta es barreja.
      const order = [...members.filter((x) => pinned.has(x)), ...A.shuffle(members.filter((x) => !pinned.has(x)))];
      const team = { name: teamName(i), color: teamColor(i), members: order.map((name) => ({ name, role: "", pinned: pinned.has(name) })) };
      assignRoles(team);
      return team;
    });
    state.last = { teams, time: Date.now() };
    // Repartiment visual: un nom cada vegada, per torns, com qui reparteix cartes.
    const host = $("teams");
    host.classList.remove("editing");
    const cards = teams.map((t, i) => teamCard({ ...t, members: [] }, i));
    host.replaceChildren(...cards);
    layout();
    const delay = A.reduced.matches ? 0 : state.duration / n,
      rounds = Math.max(...teams.map((t) => t.members.length));
    for (let j = 0; j < rounds; j++)
      for (let t = 0; t < k; t++) {
        const member = teams[t].members[j];
        if (!member) continue;
        cards[t].querySelector("ul").append(memberItem(member, delay > 0, t, j));
        cards[t].querySelector("small").textContent = j + 1;
        if (delay) {
          A.tone(520 + (t % 8) * 60, 0.05, 0, "triangle", 0.12);
          await wait(delay);
        }
      }
    busy = false;
    const label = summary();
    state.history.unshift({ label, time: state.last.time });
    state.history.length = Math.min(state.history.length, 200);
    $("resultLine").textContent = label;
    if (result.bad) A.toast("No s’han pogut complir totes les condicions: revisa-les o canvia el nombre d’equips.");
    A.sounds.win();
    persist();
    renderTeams();
    sync();
    renderHistory();
  }
  function summary() {
    const label = `${state.last.teams.length} equips · ${state.last.teams.map((t) => `${t.name}: ${t.members.map((m) => m.name).join(", ")}`).join(" · ")}`;
    return label.length > 400 ? `${label.slice(0, 397)}…` : label;
  }

  /* Retoc manual: toca un nom i després un altre (intercanvi) o un equip (canvi d'equip). */
  function editBar() {
    const bar = $("editBar");
    if (!selected || !state.last) {
      bar.hidden = true;
      return;
    }
    const m = state.last.teams[selected.t].members[selected.m];
    bar.hidden = false;
    $("editText").textContent = `${m.name}: toca un altre nom per intercanviar-los o un equip per moure-l’hi.`;
    $("pinButton").textContent = m.pinned ? "Deixa de fixar" : "📌 Fixa-ho a l’equip";
  }
  function edited() {
    if (state.history[0]?.time === state.last.time) state.history[0].label = summary();
    persist();
    renderTeams();
    renderHistory();
    editBar();
  }
  $("teams").addEventListener("click", (e) => {
    if (busy || !state.last) return;
    const member = e.target.closest(".member"),
      card = e.target.closest(".team");
    if (member) {
      const t = Number(member.dataset.team),
        m = Number(member.dataset.member);
      if (!selected) selected = { t, m };
      else if (selected.t === t && selected.m === m) selected = null;
      else {
        const a = state.last.teams[selected.t].members[selected.m],
          b = state.last.teams[t].members[m];
        // Els rols es queden a la posició: qui arriba assumeix el rol de qui se'n va.
        [a.name, b.name, a.pinned, b.pinned] = [b.name, a.name, b.pinned, a.pinned];
        A.sounds.click();
        selected = null;
      }
      return edited();
    }
    if (card && selected && Number(card.dataset.team) !== selected.t) {
      const from = state.last.teams[selected.t],
        to = state.last.teams[Number(card.dataset.team)];
      to.members.push(...from.members.splice(selected.m, 1));
      assignRoles(from);
      assignRoles(to);
      A.sounds.click();
      selected = null;
      edited();
    }
  });
  $("pinButton").addEventListener("click", () => {
    if (!selected) return;
    const m = state.last.teams[selected.t].members[selected.m];
    m.pinned = !m.pinned;
    selected = null;
    edited();
  });
  $("cancelEdit").addEventListener("click", () => {
    selected = null;
    edited();
  });
  $("unpinAll").addEventListener("click", () => {
    for (const t of state.last?.teams || []) for (const m of t.members) m.pinned = false;
    edited();
    sync();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selected) {
      selected = null;
      edited();
    }
  });

  function asText() {
    return state.last.teams.map((t) => `${t.name}\n${t.members.map((m) => `  · ${m.name}${m.role ? ` (${m.role})` : ""}`).join("\n")}`).join("\n\n");
  }

  /* Condicions i nivells */
  function renderRules() {
    const names = [...new Set(state.base)].sort((a, b) => a.localeCompare(b, "ca"));
    for (const id of ["ruleA", "ruleB"]) {
      const select = $(id),
        value = select.value;
      select.replaceChildren(...names.map((x) => new Option(x, x)));
      if (names.includes(value)) select.value = value;
      else if (id === "ruleB" && names[1]) select.value = names[1];
    }
    $("rulesList").replaceChildren(
      ...state.rules.map((r, i) => {
        const li = document.createElement("li"),
          text = document.createElement("span"),
          remove = document.createElement("button");
        text.textContent = `${r.a} ${r.type === "apart" ? "≠" : "+"} ${r.b}`;
        text.title = r.type === "apart" ? "En equips diferents" : "Al mateix equip";
        li.classList.toggle("missing", !state.base.includes(r.a) || !state.base.includes(r.b));
        li.dataset.type = r.type;
        remove.type = "button";
        remove.className = "remove-class";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Elimina la condició ${text.textContent}`);
        remove.addEventListener("click", () => {
          const before = [...state.rules];
          state.rules.splice(i, 1);
          persist();
          renderRules();
          A.undoable("Condició eliminada.", () => {
            state.rules = before;
            persist();
            renderRules();
          });
        });
        li.append(text, remove);
        return li;
      }),
    );
    $("rulesEmpty").hidden = state.rules.length > 0;
    $("rulesCount").textContent = state.rules.length ? `(${state.rules.length})` : "";
    $("balanceToggle").checked = state.balance;
    $("levelsBox").hidden = !state.balance;
    $("levelsList").replaceChildren(
      ...state.base.filter((x, i) => state.base.indexOf(x) === i).map((name) => {
        const row = document.createElement("div"),
          label = document.createElement("span"),
          group = document.createElement("div");
        row.className = "level-row";
        label.textContent = name;
        group.className = "level-buttons";
        group.setAttribute("role", "group");
        group.setAttribute("aria-label", `Nivell de ${name}`);
        for (const v of [1, 2, 3]) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = v;
          b.setAttribute("aria-pressed", String(level(name) === v));
          b.addEventListener("click", () => {
            if (v === 2) delete state.levels[name];
            else state.levels[name] = v;
            persist();
            renderRules();
          });
          group.append(b);
        }
        row.append(label, group);
        return row;
      }),
    );
  }
  $("addRule").addEventListener("click", () => {
    const a = $("ruleA").value,
      b = $("ruleB").value,
      type = $("ruleType").value;
    if (!a || !b || a === b) return A.toast("Tria dues persones diferents.");
    state.rules = state.rules.filter((r) => !((r.a === a && r.b === b) || (r.a === b && r.b === a)));
    if (state.rules.length >= 60) return A.toast("Pots tenir fins a 60 condicions.");
    state.rules.push({ a, b, type });
    persist();
    renderRules();
  });
  $("balanceToggle").addEventListener("change", (e) => {
    state.balance = e.target.checked;
    persist();
    renderRules();
  });
  $("levelsReset").addEventListener("click", () => {
    const before = { ...state.levels };
    state.levels = {};
    persist();
    renderRules();
    A.undoable("Tothom torna al nivell 2.", () => {
      state.levels = before;
      persist();
      renderRules();
    });
  });

  /* Targeta de rols */
  function showRoles() {
    const roles = splitList(state.rolesList);
    if (!roles.length) return A.toast("Escriu almenys un rol.");
    $("rolesCard").replaceChildren(
      ...roles.map((role, i) => {
        const li = document.createElement("li"),
          h = document.createElement("strong"),
          p = document.createElement("span");
        li.style.setProperty("--t", COLORS[i % COLORS.length]);
        h.textContent = role;
        p.textContent = ROLE_INFO[role.toLowerCase()] || "";
        li.append(h, p);
        return li;
      }),
    );
    $("rolesDialog").showModal();
  }

  function sync() {
    const n = people().length,
      total = state.base.length,
      k = teamCount(),
      isTeams = state.split === "teams",
      value = isTeams ? state.teams : state.size;
    $("entryCount").textContent = total;
    $("stageTitle").textContent = state.title || "Fem equips!";
    $("titleInput").value = state.title;
    for (const b of document.querySelectorAll("[data-split]")) b.setAttribute("aria-pressed", String(b.dataset.split === state.split));
    $("sizeLabel").textContent = isTeams ? "Equips" : "Persones per equip";
    $("sizeValue").textContent = value;
    $("sizeMinus").disabled = value <= 2;
    $("sizePlus").disabled = value >= Math.max(2, Math.min(n, 30));
    $("leftoverField").hidden = isTeams;
    $("leftoverInput").value = state.leftover;
    if (n >= 2) {
      const small = Math.floor(n / k),
        big = Math.ceil(n / k),
        bigCount = n % k;
      $("splitNote").textContent =
        (small === big
          ? `${k} equips ${A.de(small)}${small} ${small === 1 ? "persona" : "persones"}.`
          : `${k} equips: ${bigCount} ${A.de(big)}${big} i ${k - bigCount} ${A.de(small)}${small} ${small === 1 ? "persona" : "persones"}.`);
      $("stageSubtitle").textContent = `${n} persones · ${k} equips`;
    } else {
      $("splitNote").textContent = "Calen almenys dues persones presents.";
      $("stageSubtitle").textContent = "";
    }
    $("namesInput").value = state.names;
    $("customNamesField").hidden = state.names !== "custom";
    $("customNames").value = state.customNames;
    $("rolesToggle").checked = state.roles;
    $("rolesField").hidden = $("rolesDefault").hidden = $("rolesShow").hidden = !state.roles;
    $("rolesInput").value = state.rolesList;
    $("durationInput").value = String(state.duration);
    $("makeButton").disabled = busy || n < 2;
    $("makeLabel").textContent = state.last ? "Torna a fer equips" : "Fes equips";
    $("copyButton").disabled = busy || !state.last;
    $("exportHistory").disabled = !state.last;
    $("entriesInput").disabled = busy;
    const pinned = state.last ? state.last.teams.reduce((a, t) => a + t.members.filter((m) => m.pinned).length, 0) : 0;
    $("unpinAll").hidden = !pinned;
    $("unpinAll").textContent = `Deixa anar els fixats (${pinned})`;
    $("editHint").hidden = !state.last;
    const dup = total - new Set(state.base.map((x) => x.toLowerCase())).size;
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
    renderRules();
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
  $("leftoverInput").addEventListener("change", (e) => {
    state.leftover = e.target.value;
    persist();
    sync();
  });
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
  $("rolesShow").addEventListener("click", showRoles);
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
    const before = state.history;
    state.history = [];
    persist();
    renderHistory();
    A.undoable("Historial esborrat.", () => {
      state.history = before;
      persist();
      renderHistory();
    });
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

  A.init({ onAction: make, isBusy: () => busy, fit: { min: 280, max: 560, reserve: 0 } });
  $("entriesInput").value = state.base.join("\n");
  renderTeams();
  renderRules();
  sync();
  renderHistory();
})();
