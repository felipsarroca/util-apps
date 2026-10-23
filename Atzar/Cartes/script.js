/* Cartes — baralla espanyola o francesa, amb reposició o sense. */
(() => {
  "use strict";
  const A = window.Atzar,
    $ = A.$;
  const KEY = "felip.atzar.cartes.v1",
    MAX_CARDS = 10,
    DURATIONS = [350, 700, 1200];

  const SUITS = {
    es: [
      { id: "oros", name: "oros", color: "#a8742a", breaks: 0 },
      { id: "copes", name: "copes", color: "#c0443a", breaks: 1 },
      { id: "espases", name: "espases", color: "#2f6b84", breaks: 2 },
      { id: "bastos", name: "bastos", color: "#5f7d4f", breaks: 3 },
    ],
    fr: [
      { id: "cors", name: "cors", color: "#c0443a" },
      { id: "diamants", name: "diamants", color: "#c0443a" },
      { id: "piques", name: "piques", color: "#233f3a" },
      { id: "trevols", name: "trèvols", color: "#233f3a" },
    ],
  };
  const DECKS = {
    es40: { family: "es", ranks: [1, 2, 3, 4, 5, 6, 7, 10, 11, 12], name: "baralla espanyola de 40" },
    es48: { family: "es", ranks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], name: "baralla espanyola de 48" },
    fr52: { family: "fr", ranks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], name: "baralla francesa de 52" },
    fr54: { family: "fr", ranks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], jokers: 2, name: "baralla francesa amb comodins" },
  };
  function deckIds(type) {
    const d = DECKS[type],
      ids = [];
    for (const s of SUITS[d.family]) for (const r of d.ranks) ids.push(`${s.id}-${r}`);
    for (let j = 1; j <= (d.jokers || 0); j++) ids.push(`joker-${j}`);
    return ids;
  }
  const isFigure = (type, rank) => (DECKS[type].family === "es" ? rank >= 10 : rank >= 11);

  const state = {
    deck: "es40",
    count: 1,
    replace: false,
    remaining: deckIds("es40"),
    table: [],
    duration: 700,
    history: [],
  };
  const saved = A.load(KEY, null);
  if (saved && typeof saved === "object" && DECKS[saved.deck]) {
    const all = deckIds(saved.deck);
    state.deck = saved.deck;
    if (Number.isInteger(saved.count)) state.count = Math.min(MAX_CARDS, Math.max(1, saved.count));
    if (typeof saved.replace === "boolean") state.replace = saved.replace;
    if (DURATIONS.includes(saved.duration)) state.duration = saved.duration;
    state.remaining = Array.isArray(saved.remaining) ? [...new Set(saved.remaining.filter((id) => all.includes(id)))] : all;
    state.table = Array.isArray(saved.table) ? saved.table.filter((id) => all.includes(id)).slice(0, MAX_CARDS) : [];
    if (Array.isArray(saved.history))
      state.history = saved.history.filter((h) => h && typeof h.label === "string" && Number.isFinite(h.time)).slice(0, 200);
  }
  const persist = () => A.save(KEY, state);
  let busy = false;

  /* Noms en català */
  function parse(id) {
    const [suit, r] = id.split("-");
    return { suit, rank: Number(r) };
  }
  function suitOf(id) {
    const { suit } = parse(id);
    return SUITS[DECKS[state.deck].family].find((s) => s.id === suit);
  }
  function cardName(id) {
    const { suit, rank } = parse(id);
    if (suit === "joker") return "Comodí";
    const s = suitOf(id),
      fam = DECKS[state.deck].family;
    const names = fam === "es" ? { 1: "As", 10: "Sota", 11: "Cavall", 12: "Rei" } : { 1: "As", 11: "Valet", 12: "Reina", 13: "Rei" };
    const rankName = names[rank] || String(rank);
    return `${rankName} ${/^[aeiouàèéíòóú]/i.test(s.name) ? "d’" : "de "}${s.name}`;
  }

  /* Dibuix de les cartes en SVG (100 × 150) */
  const PIPS = {
    1: [[0.5, 0.5]],
    2: [[0.5, 0.12], [0.5, 0.88]],
    3: [[0.5, 0.12], [0.5, 0.5], [0.5, 0.88]],
    4: [[0.22, 0.12], [0.78, 0.12], [0.22, 0.88], [0.78, 0.88]],
    5: [[0.22, 0.12], [0.78, 0.12], [0.5, 0.5], [0.22, 0.88], [0.78, 0.88]],
    6: [[0.22, 0.12], [0.78, 0.12], [0.22, 0.5], [0.78, 0.5], [0.22, 0.88], [0.78, 0.88]],
    7: [[0.22, 0.12], [0.78, 0.12], [0.5, 0.31], [0.22, 0.5], [0.78, 0.5], [0.22, 0.88], [0.78, 0.88]],
    8: [[0.22, 0.12], [0.78, 0.12], [0.5, 0.31], [0.22, 0.5], [0.78, 0.5], [0.5, 0.69], [0.22, 0.88], [0.78, 0.88]],
    9: [[0.22, 0.12], [0.78, 0.12], [0.22, 0.375], [0.78, 0.375], [0.5, 0.5], [0.22, 0.625], [0.78, 0.625], [0.22, 0.88], [0.78, 0.88]],
    10: [[0.22, 0.12], [0.78, 0.12], [0.5, 0.25], [0.22, 0.375], [0.78, 0.375], [0.22, 0.625], [0.78, 0.625], [0.5, 0.75], [0.22, 0.88], [0.78, 0.88]],
  };
  const use = (href, x, y, size, flip = false) =>
    `<use href="#${href}" x="${(x - size / 2).toFixed(1)}" y="${(y - size / 2).toFixed(1)}" width="${size}" height="${size}"${flip ? ` transform="rotate(180 ${x.toFixed(1)} ${y.toFixed(1)})"` : ""}/>`;
  function cardSvg(id) {
    const { suit, rank } = parse(id),
      fam = DECKS[state.deck].family;
    let body = "";
    if (suit === "joker") {
      body = `<path d="M50 38l6.5 14 15 1.5-11.3 10 3.3 15L50 71l-13.5 7.5 3.3-15-11.3-10 15-1.5z" fill="${id === "joker-1" ? "#c0443a" : "#233f3a"}"/><text x="50" y="108" text-anchor="middle" font-size="12" font-weight="800" letter-spacing="2" fill="#233f3a">COMODÍ</text><text x="12" y="22" font-size="10" font-weight="800" fill="#233f3a">★</text>`;
      return wrap(body, "#233f3a", 0);
    }
    const s = suitOf(id),
      sym = `suit-${suit}`,
      label = fam === "es" ? String(rank) : { 1: "A", 11: "J", 12: "Q", 13: "K" }[rank] || String(rank);
    const corner = `<text x="13" y="22" text-anchor="middle" font-size="${label.length > 1 ? 12 : 14}" font-weight="800" fill="${s.color}">${label}</text>${fam === "fr" ? use(sym, 13, 32, 9) : ""}`;
    const figure = isFigure(state.deck, rank);
    if (rank === 1) {
      body = use(sym, 50, 75, fam === "es" ? 54 : 44);
    } else if (figure) {
      const title = fam === "es" ? { 10: "SOTA", 11: "CAVALL", 12: "REI" }[rank] : { 11: "VALET", 12: "REINA", 13: "REI" }[rank];
      const crown = (fam === "es" && rank === 12) || (fam === "fr" && rank >= 12);
      const emblem =
        fam === "es"
          ? rank === 10
            ? `<circle cx="50" cy="42" r="8" fill="${s.color}" opacity=".85"/><path d="M34 62c0-9 7-13 16-13s16 4 16 13z" fill="${s.color}" opacity=".85"/>`
            : rank === 11
              ? `<path d="M37 60V48a13 13 0 0 1 26 0v12h-7V48a6 6 0 0 0-12 0v12z" fill="${s.color}" opacity=".85"/><g fill="#fffefa"><circle cx="40.5" cy="55" r="1.4"/><circle cx="59.5" cy="55" r="1.4"/><circle cx="41" cy="47" r="1.4"/><circle cx="59" cy="47" r="1.4"/></g>`
              : `<use href="#crown" x="34" y="34" width="32" height="20"/>`
          : `<text x="50" y="63" text-anchor="middle" font-size="40" font-weight="800" fill="${s.color}">${label}</text>${crown ? `<use href="#crown" x="38" y="22" width="24" height="14"/>` : ""}`;
      body = `<rect x="20" y="28" width="60" height="94" rx="6" fill="${s.color}" opacity=".08"/>${emblem}${use(sym, 50, 88, 30)}<text x="50" y="114" text-anchor="middle" font-size="9" font-weight="800" letter-spacing="1.5" fill="${s.color}">${title}</text>`;
    } else {
      const pts = PIPS[rank],
        size = rank <= 3 ? 26 : rank <= 6 ? 22 : 19;
      body = pts.map(([x, y]) => use(sym, 24 + x * 52, 30 + y * 90, size, fam === "fr" && y > 0.55)).join("");
    }
    return wrap(body + corner + `<g transform="rotate(180 50 75)">${corner}</g>`, s.color, fam === "es" ? s.breaks : 0);
  }
  function wrap(inner, color, breaks) {
    // Marc interior; a la baralla espanyola, les interrupcions del marc identifiquen el pal.
    let gaps = "";
    const ys = [[], [75], [60, 90], [48, 75, 102]][breaks];
    for (const y of ys) gaps += `<rect x="4" y="${y - 5}" width="4" height="10" fill="#fffefa"/><rect x="92" y="${y - 5}" width="4" height="10" fill="#fffefa"/>`;
    return `<svg viewBox="0 0 100 150" aria-hidden="true" font-family="Segoe UI, system-ui, sans-serif"><rect x=".75" y=".75" width="98.5" height="148.5" rx="7" fill="#fffefa" stroke="#d8d2c0" stroke-width="1.5"/>${breaks !== undefined && DECKS[state.deck].family === "es" ? `<rect x="6" y="6" width="88" height="138" rx="4" fill="none" stroke="${color}" stroke-width="1.6" opacity=".7"/>${gaps}` : ""}${inner}</svg>`;
  }

  /* Disposició */
  const table = $("table"),
    deckEl = $("deck");
  function sizeCards() {
    const stage = document.querySelector(".card-stage"),
      narrow = stage.clientWidth < 520,
      n = Math.max(1, state.table.length || state.count),
      H = stage.clientHeight || 300;
    let W = stage.clientWidth,
      best = 0;
    for (let pass = 0; pass < 2; pass++) {
      const deckW = narrow ? 54 : Math.min(A.cap(130), Math.max(70, best * 0.85 || 100)),
        tableW = narrow ? W : W - deckW - 28,
        tableH = narrow ? H - deckW * 1.5 - 30 : H;
      best = 0;
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        best = Math.max(best, Math.min(tableW / (cols + (cols - 1) * 0.14), tableH / 1.5 / (rows + (rows - 1) * 0.1)));
      }
      best = Math.min(best * 0.94, A.cap(210));
      document.documentElement.style.setProperty("--deck-w", `${Math.round(deckW)}px`);
    }
    document.documentElement.style.setProperty("--card-w", `${Math.floor(best)}px`);
    document.documentElement.style.setProperty("--card-gap", `${Math.round(Math.max(10, best * 0.14))}px`);
  }
  function renderTable(animateFrom = -1) {
    table.replaceChildren(
      ...state.table.map((id, i) => {
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("role", "img");
        card.setAttribute("aria-label", cardName(id));
        card.innerHTML = `<div class="card-inner"><div class="card-front">${cardSvg(id)}</div><div class="card-back"></div></div>`;
        if (i >= animateFrom && animateFrom >= 0) card.style.visibility = "hidden";
        return card;
      }),
    );
    sizeCards();
  }
  function syncControls() {
    const total = deckIds(state.deck).length,
      left = state.replace ? total : state.remaining.length;
    $("deckInput").value = state.deck;
    $("countValue").textContent = state.count;
    $("countMinus").disabled = busy || state.count <= 1;
    $("countPlus").disabled = busy || state.count >= MAX_CARDS;
    $("replaceToggle").checked = state.replace;
    $("durationInput").value = String(state.duration);
    $("deckCount").textContent = state.replace ? `${total} · amb reposició` : `${left} de ${total}`;
    $("leftCount").textContent = left;
    deckEl.classList.toggle("empty", !left);
    $("drawButton").disabled = deckEl.disabled = busy || !left;
    $("collectButton").disabled = busy || (state.replace ? !state.table.length : left === total && !state.table.length);
    $("drawLabel").textContent = !left ? "No queden cartes" : state.count === 1 ? "Treu una carta" : `Treu ${state.count} cartes`;
    $("modeNote").textContent = state.replace
      ? "Cada tirada torna les cartes a la baralla abans de treure’n de noves."
      : "Les cartes tretes no tornen a la baralla fins que la recullis.";
    $("stageSubtitle").textContent = `${DECKS[state.deck].name.replace(/^./, (c) => c.toUpperCase())} · ${state.replace ? "amb reposició" : "sense reposició"}`;
  }

  function draw() {
    if (busy) return;
    const pool = state.replace ? deckIds(state.deck) : [...state.remaining];
    if (!pool.length) return A.toast("No queden cartes. Recull i barreja.");
    A.audioReady();
    busy = true;
    const n = Math.min(state.count, pool.length),
      hand = [];
    for (let i = 0; i < n; i++) hand.push(pool.splice(A.randomInt(pool.length), 1)[0]);
    if (!state.replace) state.remaining = state.remaining.filter((id) => !hand.includes(id));
    state.table = hand;
    $("resultLine").textContent = "";
    syncControls();
    renderTable(0);
    const motion = !A.reduced.matches,
      deckRect = deckEl.getBoundingClientRect();
    const cards = [...table.children];
    const done = cards.map((card, i) => {
      const delay = i * Math.max(90, state.duration * 0.28);
      return new Promise((resolve) => {
        setTimeout(() => {
          card.style.visibility = "";
          A.noise(0.07, 0, 0.18, 2600);
          if (!motion) return resolve();
          const r = card.getBoundingClientRect(),
            dx = deckRect.left + deckRect.width / 2 - (r.left + r.width / 2),
            dy = deckRect.top + deckRect.height / 2 - (r.top + r.height / 2),
            scale = deckRect.width / r.width;
          card
            .querySelector(".card-inner")
            .animate(
              [
                { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotateY(180deg)` },
                { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 30}px) scale(${(scale + 1.08) / 2}) rotateY(150deg)`, offset: 0.45 },
                { transform: "translate(0, 0) scale(1.05) rotateY(0deg)", offset: 0.85 },
                { transform: "translate(0, 0) scale(1) rotateY(0deg)" },
              ],
              { duration: state.duration, easing: "cubic-bezier(.3,.6,.35,1)" },
            )
            .finished.then(resolve, resolve);
        }, motion ? delay : 0);
      });
    });
    Promise.all(done).then(() => {
      busy = false;
      const names = hand.map(cardName);
      const line = $("resultLine");
      line.replaceChildren();
      names.forEach((name, i) => {
        if (i) line.append(" · ");
        const s = document.createElement("strong");
        s.textContent = name;
        line.append(s);
      });
      if (!state.replace && !state.remaining.length) line.append(" — s’ha acabat la baralla");
      state.history.unshift({ label: names.join(", "), time: Date.now() });
      state.history.length = Math.min(state.history.length, 200);
      A.sounds.click();
      persist();
      syncControls();
      renderLeft();
      renderHistory();
    });
  }
  function collect() {
    if (busy) return;
    state.remaining = deckIds(state.deck);
    state.table = [];
    $("resultLine").textContent = "Baralla completa i barrejada.";
    A.audioReady();
    for (let i = 0; i < 6; i++) A.noise(0.04, i * 0.06, 0.12, 2200 + i * 120);
    persist();
    renderTable();
    syncControls();
    renderLeft();
  }

  function renderLeft() {
    const total = deckIds(state.deck),
      pool = state.replace ? total : state.remaining,
      n = pool.length,
      fam = DECKS[state.deck].family;
    $("leftNote").textContent = state.replace
      ? "Amb reposició, cada tirada es fa amb la baralla completa: les probabilitats no canvien."
      : n
        ? `Queden ${n} cartes. Probabilitat que la propera carta sigui…`
        : "No queda cap carta. Recull i barreja per començar de nou.";
    const rows = SUITS[fam].map((s) => ({ icon: `suit-${s.id}`, label: s.name.replace(/^./, (c) => c.toUpperCase()), k: pool.filter((id) => id.startsWith(`${s.id}-`)).length }));
    rows.push({ icon: null, label: fam === "es" ? "Figura (sota, cavall o rei)" : "Figura (J, Q o K)", k: pool.filter((id) => !id.startsWith("joker") && isFigure(state.deck, parse(id).rank)).length });
    rows.push({ icon: null, label: "As", k: pool.filter((id) => parse(id).rank === 1 && !id.startsWith("joker")).length });
    if (DECKS[state.deck].jokers) rows.push({ icon: null, label: "Comodí", k: pool.filter((id) => id.startsWith("joker")).length });
    $("probTable").replaceChildren(
      ...rows.map((r) => {
        const row = document.createElement("div"),
          p = n ? r.k / n : 0;
        row.className = "prob-row";
        row.innerHTML = `${r.icon ? `<svg viewBox="0 0 40 40" aria-hidden="true"><use href="#${r.icon}"/></svg>` : "<i></i>"}<b></b><span>${r.k}/${n}</span><strong>${n ? A.pct(p, 1) : "—"}</strong><div class="bar"><i style="width:${(p * 100).toFixed(1)}%"></i></div>`;
        row.querySelector("b").textContent = r.label;
        row.querySelector("b").style.fontWeight = 600;
        return row;
      }),
    );
    const out = new Set(state.replace ? [] : total.filter((id) => !state.remaining.includes(id)));
    const ranks = DECKS[state.deck].ranks,
      label = (r) => (fam === "es" ? { 10: "S", 11: "C", 12: "R" }[r] || r : { 1: "A", 11: "J", 12: "Q", 13: "K" }[r] || r);
    $("leftGrid").replaceChildren(
      ...SUITS[fam].map((s) => {
        const row = document.createElement("div");
        row.className = "left-suit";
        row.innerHTML = `<svg viewBox="0 0 40 40" aria-label="${s.name}"><use href="#suit-${s.id}"/></svg>` + ranks.map((r) => `<span class="${out.has(`${s.id}-${r}`) ? "out" : ""}" title="${cardName(`${s.id}-${r}`)}">${label(r)}</span>`).join("");
        return row;
      }),
    );
  }
  function renderHistory() {
    A.renderHistory($("historyList"), $("historyEmpty"), state.history, $("historyCount"));
    $("exportHistory").disabled = $("clearHistory").disabled = !state.history.length;
  }

  $("drawButton").addEventListener("click", draw);
  deckEl.addEventListener("click", draw);
  $("collectButton").addEventListener("click", collect);
  $("deckInput").addEventListener("change", (e) => {
    state.deck = e.target.value;
    state.remaining = deckIds(state.deck);
    state.table = [];
    $("resultLine").textContent = "";
    persist();
    renderTable();
    syncControls();
    renderLeft();
  });
  $("countMinus").addEventListener("click", () => {
    state.count = Math.max(1, state.count - 1);
    persist();
    syncControls();
    sizeCards();
  });
  $("countPlus").addEventListener("click", () => {
    state.count = Math.min(MAX_CARDS, state.count + 1);
    persist();
    syncControls();
    sizeCards();
  });
  $("replaceToggle").addEventListener("change", (e) => {
    state.replace = e.target.checked;
    if (state.replace) state.remaining = deckIds(state.deck);
    persist();
    syncControls();
    renderLeft();
  });
  $("durationInput").addEventListener("change", (e) => {
    state.duration = Number(e.target.value);
    persist();
  });
  $("clearHistory").addEventListener("click", () => {
    state.history = [];
    persist();
    renderHistory();
  });
  $("exportHistory").addEventListener("click", () =>
    A.downloadCsv("cartes-resultats.csv", [
      ["Data", "Hora", "Cartes"],
      ...state.history.map((h) => [new Date(h.time).toLocaleDateString("ca"), A.formatTime(h.time), h.label]),
    ]),
  );
  document.addEventListener("atzar:fit", sizeCards);

  A.init({ onAction: draw, isBusy: () => busy, fit: { min: 240, max: 520 } });
  renderTable();
  syncControls();
  renderLeft();
  renderHistory();
})();
