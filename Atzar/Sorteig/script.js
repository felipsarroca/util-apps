/* Sorteig — paperets d'un barret: triar-ne uns quants o ordenar-los tots. */
(() => {
  "use strict";
  const A = window.Atzar,
    $ = A.$;
  const KEY = "felip.atzar.sorteig.v1",
    DURATIONS = [400, 900, 1600],
    COLORS = ["#e2ad55", "#759479", "#d47761", "#5f91a6", "#817ca6", "#c78294", "#519b92"];
  const DEFAULTS = ["Anna", "Biel", "Clàudia", "David", "Emma", "Guillem", "Júlia", "Marc"];
  const valid = (a) => Array.isArray(a) && a.length <= 200 && a.every((x) => typeof x === "string" && x.trim() && x.length <= 80);
  const state = {
    base: [...DEFAULTS],
    pool: [...DEFAULTS],
    mode: "pick",
    qty: 1,
    retire: false,
    title: "",
    duration: 900,
    confetti: true,
    last: [],
    history: [],
  };
  const saved = A.load(KEY, null);
  if (saved && typeof saved === "object" && valid(saved.base)) {
    state.base = saved.base;
    state.pool = valid(saved.pool) ? saved.pool : [...saved.base];
    if (["pick", "order"].includes(saved.mode)) state.mode = saved.mode;
    if (Number.isInteger(saved.qty)) state.qty = Math.max(1, Math.min(200, saved.qty));
    for (const k of ["retire", "confetti"]) if (typeof saved[k] === "boolean") state[k] = saved[k];
    if (typeof saved.title === "string") state.title = saved.title.slice(0, 70);
    if (DURATIONS.includes(saved.duration)) state.duration = saved.duration;
    if (valid(saved.last)) state.last = saved.last;
    if (Array.isArray(saved.history)) state.history = saved.history.filter((h) => h && typeof h.label === "string" && Number.isFinite(h.time)).slice(0, 200);
  }
  const persist = () => A.save(KEY, state);
  let busy = false,
    inputTimer;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function source() {
    return A.present(state.retire ? state.pool : state.base);
  }
  function sizeStage() {
    const area = document.querySelector(".draw-stage"),
      W = area.clientWidth || 320,
      H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--play-height")) || 360;
    const hat = W < 600 ? 150 : Math.floor(Math.min(A.cap(260), H * 0.6, W * 0.33));
    area.style.setProperty("--hat", `${hat}px`);
    const n = Math.max(1, $("winners").children.length);
    const [font, min] = n <= 2 ? [30, 260] : n <= 4 ? [24, 240] : n <= 8 ? [19, 200] : n <= 16 ? [16, 170] : [14, 140];
    area.style.setProperty("--slip-font", `${Math.round(A.cap(font))}px`);
    area.style.setProperty("--slip-min", `${Math.min(A.cap(min), W - 20)}px`);
  }
  /* El paperet mostra el nom sencer: la lletra s'ajusta perquè cap paraula es parteixi. */
  function placeReveal(name) {
    const reveal = $("reveal"),
      stage = document.querySelector(".draw-stage"),
      sw = stage.clientWidth,
      maxW = Math.min(A.cap(460), sw - 16),
      inner = maxW - 56,
      longest = Math.max(1, ...name.split(/\s+/).map((w) => w.length));
    const font = Math.max(14, Math.min(A.cap(40), inner / (longest * 0.62), (inner * 2) / (name.length * 0.6)));
    reveal.firstElementChild.textContent = name;
    reveal.style.setProperty("--reveal-font", `${Math.floor(font)}px`);
    reveal.style.maxWidth = `${maxW}px`;
    const s = stage.getBoundingClientRect(),
      h = $("hat").getBoundingClientRect(),
      w = reveal.offsetWidth,
      cx = h.left - s.left + h.width / 2;
    reveal.style.left = `${Math.max(8, Math.min(sw - w - 8, cx - w / 2))}px`;
    reveal.style.top = `${Math.max(-40, h.top - s.top + h.height * 0.3 - reveal.offsetHeight)}px`;
  }
  function addWinner(name, i) {
    const li = document.createElement("li");
    li.textContent = name;
    li.style.setProperty("--slip", COLORS[i % COLORS.length]);
    $("winners").append(li);
    sizeStage();
    li.scrollIntoView({ block: "nearest" });
  }
  function sync() {
    const src = source(),
      n = state.base.length;
    $("entryCount").textContent = n;
    $("stageTitle").textContent = state.title || (state.mode === "order" ? "En quin ordre?" : "A qui li toca?");
    $("titleInput").value = state.title;
    const away = state.base.length - A.present(state.base).length;
    $("poolCount").textContent =
      (state.retire ? `Al barret: ${src.length} de ${n}` : `${src.length} ${src.length === 1 ? "paperet" : "paperets"} al barret`) + (away ? ` · ${away} ${away === 1 ? "absent" : "absents"}` : "");
    $("stageSubtitle").textContent =
      state.mode === "order" ? "Ordre aleatori de tota la llista" : `${state.qty === 1 ? "Un paperet" : `${state.qty} paperets`}${state.retire ? " · sense tornar-los al barret" : ""}`;
    for (const b of document.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode));
    $("pickRow").hidden = state.mode === "order";
    $("qtyValue").textContent = state.qty;
    $("qtyMinus").disabled = state.qty <= 1;
    $("qtyPlus").disabled = state.qty >= Math.max(1, A.present(state.base).length);
    $("retireToggle").checked = state.retire;
    $("restoreButton").hidden = !state.retire;
    $("restoreButton").disabled = state.pool.length === n;
    $("confettiToggle").checked = state.confetti;
    $("durationInput").value = String(state.duration);
    const k = state.mode === "order" ? src.length : Math.min(state.qty, src.length);
    $("drawLabel").textContent = !src.length ? "El barret és buit" : state.mode === "order" ? "Ordena’ls tots" : k === 1 ? "Treu un paperet" : `Treu ${k} paperets`;
    $("drawButton").disabled = $("hat").disabled = busy || !src.length;
    $("copyButton").disabled = busy || !state.last.length;
    for (const b of document.querySelectorAll("[data-mode]")) b.disabled = busy;
    $("entriesInput").disabled = busy;
    document.querySelector(".draw-stage").classList.toggle("idle", !busy && !state.last.length);
    const dup = n - new Set(state.base.map((x) => x.toLowerCase())).size;
    $("entryFeedback").textContent = dup ? `Hi ha ${dup} ${dup === 1 ? "nom repetit" : "noms repetits"}: cada línia és un paperet.` : "";
    sizeStage();
  }

  async function draw() {
    const src = [...source()];
    if (busy || !src.length) return;
    A.audioReady();
    busy = true;
    const n = state.mode === "order" ? src.length : Math.min(state.qty, src.length);
    const picks = A.shuffle(src).slice(0, n);
    if (state.retire) {
      const pool = [...state.pool];
      for (const p of picks) pool.splice(pool.indexOf(p), 1);
      state.pool = pool;
    }
    state.last = picks;
    $("winners").replaceChildren();
    sync();
    const motion = !A.reduced.matches,
      hat = $("hat"),
      reveal = $("reveal");
    if (motion) {
      hat.classList.add("shaking");
      for (let i = 0; i < 6; i++) A.noise(0.05, i * 0.09, 0.14, 1600 + A.randomInt(1200));
      await wait(Math.min(1200, state.duration * 0.9));
      hat.classList.remove("shaking");
    }
    // Amb moltes persones, el ritme s'accelera perquè l'ordre complet no s'allargui.
    const step = motion ? Math.max(140, Math.min(state.duration, 7000 / n)) : 0;
    for (let i = 0; i < picks.length; i++) {
      if (motion) {
        placeReveal(picks[i]);
        reveal.style.setProperty("--slip", COLORS[i % COLORS.length]);
        reveal.style.setProperty("--reveal-time", `${Math.round(step * 0.85)}ms`);
        reveal.classList.remove("show");
        void reveal.offsetWidth;
        reveal.classList.add("show");
        A.tone(700 + Math.min(i, 20) * 25, 0.08, 0, "triangle", 0.14);
        await wait(step);
      }
      addWinner(picks[i], i);
    }
    reveal.classList.remove("show");
    busy = false;
    const label = state.mode === "order" ? `Ordre: ${picks.map((p, i) => `${i + 1}. ${p}`).join(", ")}` : picks.join(", ");
    state.history.unshift({ label, time: Date.now() });
    state.history.length = Math.min(state.history.length, 200);
    $("resultLine").textContent = label;
    A.sounds.win();
    if (state.confetti) A.confetti($("confetti"));
    if (state.retire && !state.pool.length) A.toast("Ja han sortit tots els paperets. Torna’ls al barret per començar de nou.");
    persist();
    sync();
    renderHistory();
  }

  function setBase(entries) {
    state.base = entries;
    state.pool = [...entries];
    state.qty = Math.min(state.qty, Math.max(1, entries.length));
    persist();
    sync();
    renderAbsents();
  }
  function renderHistory() {
    A.renderHistory($("historyList"), $("historyEmpty"), state.history, $("historyCount"));
    $("exportHistory").disabled = $("clearHistory").disabled = !state.history.length;
  }

  $("drawButton").addEventListener("click", draw);
  $("hat").addEventListener("click", draw);
  $("entriesInput").addEventListener("input", (e) => {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => setBase(A.parseLines(e.target.value)), 250);
  });
  for (const b of document.querySelectorAll("[data-mode]"))
    b.addEventListener("click", () => {
      state.mode = b.dataset.mode;
      persist();
      sync();
    });
  $("qtyMinus").addEventListener("click", () => {
    state.qty = Math.max(1, state.qty - 1);
    persist();
    sync();
  });
  $("qtyPlus").addEventListener("click", () => {
    state.qty = Math.min(state.base.length, state.qty + 1);
    persist();
    sync();
  });
  $("retireToggle").addEventListener("change", (e) => {
    state.retire = e.target.checked;
    state.pool = [...state.base];
    persist();
    sync();
  });
  $("restoreButton").addEventListener("click", () => {
    const before = state.pool;
    state.pool = [...state.base];
    persist();
    sync();
    A.undoable("Tots els paperets tornen a ser al barret.", () => {
      state.pool = before;
      persist();
      sync();
    });
  });
  $("copyButton").addEventListener("click", () => A.copyText(state.last.map((p, i) => (state.last.length > 1 ? `${i + 1}. ${p}` : p)).join("\n")));
  $("titleInput").addEventListener("input", (e) => {
    state.title = e.target.value.slice(0, 70);
    persist();
    sync();
  });
  $("durationInput").addEventListener("change", (e) => {
    state.duration = Number(e.target.value);
    persist();
  });
  $("confettiToggle").addEventListener("change", (e) => {
    state.confetti = e.target.checked;
    persist();
  });
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
    A.downloadCsv("sorteig-resultats.csv", [
      ["Data", "Hora", "Resultat"],
      ...state.history.map((h) => [new Date(h.time).toLocaleDateString("ca"), A.formatTime(h.time), h.label]),
    ]),
  );
  const renderAbsents = A.setupAbsents({ host: $("absentList"), getNames: () => state.base, onChange: sync });
  A.setupClasses({
    getEntries: () => state.base,
    onLoad: (group) => {
      $("entriesInput").value = group.entries.join("\n");
      setBase([...group.entries]);
    },
  });
  document.addEventListener("atzar:fit", sizeStage);

  A.init({ onAction: draw, isBusy: () => busy, fit: { min: 260, max: 520 } });
  $("entriesInput").value = state.base.join("\n");
  state.last.forEach((name, i) => addWinner(name, i));
  sync();
  renderHistory();
})();
