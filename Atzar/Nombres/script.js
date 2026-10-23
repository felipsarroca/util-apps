/* Nombres — nombres en un interval, bombo amb tauler i lletres a l'atzar. */
(() => {
  "use strict";
  const A = window.Atzar,
    $ = A.$;
  const KEY = "felip.atzar.nombres.v1",
    MODES = ["number", "bingo", "letter"],
    DURATIONS = [500, 1300, 2500],
    MAX_QTY = 50,
    LIMIT = 1e9;
  const ALPHABET = [..."ABCÇDEFGHIJKLMNOPQRSTUVWXYZ"],
    UNUSUAL = ["Ç", "K", "W", "Y"];
  const COLORS = ["#817ca6", "#5f91a6", "#d47761", "#759479", "#e2ad55", "#c78294", "#519b92"];
  const TITLES = { number: "Un nombre a l’atzar", bingo: "Bombo", letter: "Una lletra a l’atzar" };
  const LABELS = { number: "Genera", bingo: "Treu una bola", letter: "Treu una lletra" };
  const IDEAS = {
    number: [
      ["Qui surt a la pissarra?", "Interval de l’1 al nombre d’alumnes de la llista, sense repetir."],
      ["Endevina el nombre secret.", "Activa «Nombre secret» i la classe proposa nombres amb pistes «més gran» o «més petit». Quants intents calen, com a màxim, entre 1 i 100? (Pista: cada pregunta pot partir l’interval per la meitat.)"],
      ["Dades per a l’estadística.", "Vint nombres de l’1 al 10, amb repetició i ordenats: freqüències, mitjana, mediana i moda."],
      ["Operacions amb enters.", "Dos nombres entre −10 i 10 per practicar sumes, restes i productes amb signes."],
    ],
    bingo: [
      ["Bingo de càlcul.", "Cada alumne escriu al cartró resultats possibles; el docent canta cada bola com una operació (per al 42: «sis per set»)."],
      ["Nombres en català.", "Amb la veu activada, l’alumnat nouvingut escolta i marca els nombres al seu cartró."],
      ["Nombres en altres llengües.", "El docent diu el número de la bola en anglès o francès i l’alumnat l’ha de reconèixer."],
      ["Torns de tota la setmana.", "Bombo amb el nombre d’alumnes: cada bola és un torn i ningú no repeteix fins que es buida el tauler."],
    ],
    letter: [
      ["L’Stop.", "Categories (nom, animal, país, fruita, verb…) i paraules que comencin per la lletra. Qui acaba primer diu «Stop!»."],
      ["Vocabulari d’una matèria.", "Termes d’història, ciències o economia que comencin per la lletra, amb definició."],
      ["Tautogrames.", "Una frase on totes les paraules comencin per la mateixa lletra: «Marta menja mores madures»."],
      ["Ortografia.", "Paraules amb la lletra a l’inici, al mig i al final."],
    ],
  };
  const state = {
    mode: "number",
    min: 1,
    max: 100,
    qty: 1,
    unique: true,
    sort: false,
    secret: false,
    bingoMax: 90,
    bingoDrawn: [],
    speak: false,
    letters: ALPHABET.filter((l) => !UNUSUAL.includes(l)),
    usedLetters: [],
    letterUnique: true,
    duration: 1300,
    history: [],
  };
  const saved = A.load(KEY, null);
  if (saved && typeof saved === "object") {
    if (MODES.includes(saved.mode)) state.mode = saved.mode;
    for (const k of ["min", "max"]) if (Number.isInteger(saved[k]) && Math.abs(saved[k]) <= LIMIT) state[k] = saved[k];
    if (Number.isInteger(saved.qty)) state.qty = Math.min(MAX_QTY, Math.max(1, saved.qty));
    for (const k of ["unique", "sort", "secret", "speak", "letterUnique"]) if (typeof saved[k] === "boolean") state[k] = saved[k];
    if (Number.isInteger(saved.bingoMax) && saved.bingoMax >= 5 && saved.bingoMax <= 200) state.bingoMax = saved.bingoMax;
    if (Array.isArray(saved.bingoDrawn)) state.bingoDrawn = [...new Set(saved.bingoDrawn.filter((n) => Number.isInteger(n) && n >= 1 && n <= state.bingoMax))];
    if (Array.isArray(saved.letters)) state.letters = ALPHABET.filter((l) => saved.letters.includes(l));
    if (Array.isArray(saved.usedLetters)) state.usedLetters = ALPHABET.filter((l) => saved.usedLetters.includes(l));
    if (DURATIONS.includes(saved.duration)) state.duration = saved.duration;
    if (Array.isArray(saved.history)) state.history = saved.history.filter((h) => h && typeof h.label === "string" && Number.isFinite(h.time)).slice(0, 200);
  }
  const persist = () => A.save(KEY, state);
  let busy = false,
    secretValue = null,
    attempts = [],
    lastNumbers = [];

  /* Utilitats */
  const fmt = (n) => n.toLocaleString("ca");
  function sampleNumbers() {
    const { min, max, qty, unique } = state,
      size = max - min + 1;
    const n = state.secret ? 1 : qty;
    if (unique && n > size) return null;
    const values = [];
    const seen = new Set();
    while (values.length < n) {
      const v = min + A.randomInt(size);
      if (unique && seen.has(v)) continue;
      seen.add(v);
      values.push(v);
    }
    return state.sort ? values.sort((a, b) => a - b) : values;
  }
  function digitsScale(text) {
    const len = String(text).length;
    return len <= 2 ? 0.4 : len === 3 ? 0.3 : len === 4 ? 0.23 : len <= 6 ? 0.16 : 0.11;
  }
  /* El resultat ja es veu a l'escenari; només s'anuncia als lectors de pantalla. */
  function announce(text) {
    $("liveResult").textContent = text;
  }
  function setResultLine(...nodes) {
    $("resultLine").replaceChildren(...nodes);
    A.fitLayout();
  }
  function addHistory(label) {
    state.history.unshift({ label, time: Date.now() });
    state.history.length = Math.min(state.history.length, 200);
  }
  function flicker(set, final, duration, tick = true) {
    return new Promise((resolve) => {
      if (A.reduced.matches) {
        set(final);
        return resolve();
      }
      const start = performance.now();
      let wait = 45;
      (function step() {
        const t = performance.now() - start;
        if (t >= duration) {
          set(final);
          return resolve();
        }
        set(null);
        if (tick) A.sounds.tick();
        wait = 45 + 260 * Math.pow(t / duration, 2.2);
        setTimeout(step, wait);
      })();
    });
  }
  let voice = null,
    voiceWarned = false;
  function speak(text) {
    if (!state.speak || !("speechSynthesis" in window) || A.prefs.muted) return;
    voice ||= speechSynthesis.getVoices().find((v) => /^ca(-|_|$)/i.test(v.lang)) || null;
    if (!voice && !voiceWarned) {
      voiceWarned = true;
      A.toast("No s’ha trobat cap veu catalana al dispositiu; s’usarà la veu per defecte.");
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ca-ES";
    if (voice) u.voice = voice;
    u.rate = 0.9;
    u.volume = Math.max(0.2, A.prefs.volume / 100);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  if ("speechSynthesis" in window) speechSynthesis.addEventListener?.("voiceschanged", () => (voice = null));

  /* Mides */
  function sizeViews() {
    const H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--play-height")) || 360;
    const area = document.querySelector(".play-area"),
      W = area.clientWidth || 320;
    // Boles de nombres
    const n = Math.max(1, $("numberView").children.length);
    let best = 0;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      best = Math.max(best, Math.min(W / (cols + (cols - 1) * 0.12), H / (rows + (rows - 1) * 0.12)));
    }
    const ball = Math.floor(Math.min(best * 0.9, A.cap(300)));
    $("numberView").style.setProperty("--ball", `${ball}px`);
    $("numberView").style.setProperty("--ball-gap", `${Math.round(Math.max(8, ball * 0.12))}px`);
    // Bombo
    const narrow = W < 600,
      cols = state.bingoMax <= 100 ? 10 : 15,
      rows = Math.ceil(state.bingoMax / cols),
      big = Math.floor(narrow ? Math.min(110, H * 0.28) : Math.min(A.cap(200), H * 0.55, W * 0.26));
    const boardW = narrow ? W : W - big - 24,
      boardH = narrow ? H - big - 12 : H;
    const cell = Math.max(16, Math.floor(Math.min((boardW - (cols - 1) * 4) / cols, (boardH - (rows - 1) * 4) / rows, A.cap(72))));
    const view = $("bingoView");
    view.style.setProperty("--bingo-ball", `${big}px`);
    view.style.setProperty("--cols", cols);
    view.style.setProperty("--cell", `${cell}px`);
    // Lletra
    $("letterView").style.setProperty("--tile", `${Math.floor(Math.min(H * 0.82, W * 0.8, A.cap(320)))}px`);
  }

  /* Mode nombres */
  function renderBalls(values) {
    const host = $("numberView");
    host.classList.toggle("secret", state.secret && secretValue !== null);
    host.replaceChildren(
      ...values.map((v, i) => {
        const ball = document.createElement("div"),
          span = document.createElement("span");
        ball.className = "ball";
        ball.style.setProperty("--c", COLORS[i % COLORS.length]);
        span.textContent = v === null ? "?" : fmt(v);
        ball.style.setProperty("--digits-scale", digitsScale(span.textContent));
        ball.append(span);
        return ball;
      }),
    );
    sizeViews();
  }
  async function drawNumbers() {
    const values = sampleNumbers();
    if (!values) return A.toast("No hi ha prou nombres diferents en aquest interval.");
    busy = true;
    sync();
    attempts = [];
    secretValue = state.secret ? values[0] : null;
    setResultLine();
    announce("");
    renderBalls(values.map(() => null));
    const balls = [...$("numberView").children],
      size = state.max - state.min + 1;
    await Promise.all(
      balls.map((ball, i) =>
        flicker(
          (v) => {
            const span = ball.firstChild,
              shown = v ?? state.min + A.randomInt(size);
            span.textContent = fmt(shown);
            ball.style.setProperty("--digits-scale", digitsScale(span.textContent));
            ball.classList.toggle("rolling", v === null);
            if (v !== null) ball.classList.add("settled");
          },
          values[i],
          state.duration * (1 + i * 0.06),
          i === 0,
        ),
      ),
    );
    busy = false;
    lastNumbers = values;
    if (state.secret) {
      setResultLine(`He pensat un nombre entre ${fmt(state.min)} i ${fmt(state.max)}. Quin és?`);
      $("guessInput").value = "";
      $("guessInput").focus({ preventScroll: true });
      addHistory(`Nombre secret entre ${fmt(state.min)} i ${fmt(state.max)}`);
    } else {
      announce(values.map(fmt).join(", "));
      addHistory(values.map(fmt).join(", "));
      A.sounds.win();
    }
    persist();
    sync();
    renderHistory();
  }
  function guess(e) {
    e.preventDefault();
    if (secretValue === null) return;
    const value = Number($("guessInput").value);
    if (!Number.isInteger(value)) return A.toast("Escriu un nombre enter.");
    attempts.push(value);
    let msg;
    if (value === secretValue) {
      msg = `Encertat! Era el ${fmt(secretValue)}, en ${attempts.length} ${attempts.length === 1 ? "intent" : "intents"}.`;
      reveal(true);
      A.sounds.win();
      A.confetti(null);
    } else {
      msg = value < secretValue ? `El ${fmt(value)} és massa petit: és més gran ↑` : `El ${fmt(value)} és massa gran: és més petit ↓`;
      A.tone(value < secretValue ? 520 : 390, 0.15, 0, "triangle", 0.15);
    }
    const big = document.createElement("span");
    big.className = "big";
    big.textContent = msg;
    const tried = document.createElement("span");
    tried.textContent = `Intents: ${attempts.map(fmt).join(", ")}`;
    setResultLine(big, tried);
    $("guessInput").value = "";
  }
  function reveal(found = false) {
    if (secretValue === null) return;
    $("numberView").classList.remove("secret");
    if (!found) {
      setResultLine(`Era el ${fmt(secretValue)}.`);
      A.sounds.click();
    }
    state.history[0] = { label: `Nombre secret: ${fmt(secretValue)}${attempts.length ? ` (${attempts.length} intents)` : ""}`, time: state.history[0]?.time || Date.now() };
    secretValue = null;
    persist();
    renderHistory();
    sync();
  }

  /* Mode bombo */
  function renderBoard() {
    const drawn = new Set(state.bingoDrawn),
      last = state.bingoDrawn.at(-1);
    $("bingoBoard").replaceChildren(
      ...Array.from({ length: state.bingoMax }, (_, i) => {
        const cell = document.createElement("span");
        cell.textContent = i + 1;
        if (drawn.has(i + 1)) cell.className = i + 1 === last ? "last" : "out";
        return cell;
      }),
    );
    $("bingoBall").firstElementChild.textContent = last ?? "?";
    $("bingoBall").style.setProperty("--digits-scale", digitsScale(last ?? "?"));
    $("bingoCount").textContent = `${state.bingoDrawn.length} de ${state.bingoMax}`;
    sizeViews();
  }
  async function drawBingo() {
    const left = Array.from({ length: state.bingoMax }, (_, i) => i + 1).filter((n) => !state.bingoDrawn.includes(n));
    if (!left.length) return A.toast("Ja han sortit totes les boles. Buida el tauler.");
    busy = true;
    sync();
    const value = left[A.randomInt(left.length)],
      ball = $("bingoBall"),
      span = ball.firstElementChild;
    ball.classList.remove("settled");
    await flicker(
      (v) => {
        span.textContent = v ?? left[A.randomInt(left.length)];
        ball.style.setProperty("--digits-scale", digitsScale(span.textContent));
      },
      value,
      state.duration,
    );
    ball.classList.add("settled");
    state.bingoDrawn.push(value);
    busy = false;
    addHistory(`Bombo: ${value}`);
    persist();
    renderBoard();
    sync();
    renderHistory();
    announce(`Ha sortit el ${value}`);
    A.sounds.win();
    speak(String(value));
  }

  /* Mode lletra */
  function renderLetterChips() {
    $("letterChips").replaceChildren(
      ...ALPHABET.map((l) => {
        const b = document.createElement("button");
        b.textContent = l;
        b.setAttribute("aria-pressed", String(state.letters.includes(l)));
        b.classList.toggle("used", state.letterUnique && state.usedLetters.includes(l));
        b.title = state.usedLetters.includes(l) ? "Ja ha sortit" : "";
        b.addEventListener("click", () => {
          state.letters = state.letters.includes(l) ? state.letters.filter((x) => x !== l) : ALPHABET.filter((x) => x === l || state.letters.includes(x));
          persist();
          renderLetterChips();
          sync();
        });
        return b;
      }),
    );
  }
  async function drawLetter() {
    const pool = state.letters.filter((l) => !state.letterUnique || !state.usedLetters.includes(l));
    if (!pool.length) return A.toast(state.letters.length ? "Ja han sortit totes les lletres. Recupera les usades." : "Tria almenys una lletra.");
    busy = true;
    sync();
    const value = pool[A.randomInt(pool.length)],
      tile = $("letterTile");
    tile.classList.remove("settled");
    await flicker((v) => (tile.firstElementChild.textContent = v ?? A.pick(state.letters)), value, state.duration);
    tile.classList.add("settled");
    if (!state.usedLetters.includes(value)) state.usedLetters.push(value);
    busy = false;
    addHistory(`Lletra: ${value}`);
    persist();
    renderLetterChips();
    sync();
    renderHistory();
    announce(`Lletra ${value}`);
    A.sounds.win();
  }

  /* Comú */
  function draw() {
    if (busy) return;
    A.audioReady();
    if (state.mode === "number") drawNumbers();
    else if (state.mode === "bingo") drawBingo();
    else drawLetter();
  }
  function validateRange() {
    const min = Number($("minInput").value),
      max = Number($("maxInput").value);
    let error = "";
    if (!Number.isInteger(min) || !Number.isInteger(max)) error = "Escriu nombres enters.";
    else if (Math.abs(min) > LIMIT || Math.abs(max) > LIMIT) error = "Fes servir nombres de fins a mil milions.";
    else if (min > max) error = "El primer nombre ha de ser més petit que el segon.";
    else {
      state.min = min;
      state.max = max;
      if (state.unique && !state.secret && state.qty > max - min + 1) error = `Sense repetir, només hi ha ${fmt(max - min + 1)} nombres diferents.`;
    }
    $("numberNote").textContent = error;
    $("numberNote").classList.toggle("error", !!error);
    return !error;
  }
  function sync() {
    const m = state.mode;
    for (const b of document.querySelectorAll("[data-mode]")) {
      b.setAttribute("aria-pressed", String(b.dataset.mode === m));
      b.disabled = busy;
    }
    $("numberView").hidden = $("numberOptions").hidden = m !== "number";
    $("bingoView").hidden = $("bingoOptions").hidden = m !== "bingo";
    $("letterView").hidden = $("letterOptions").hidden = m !== "letter";
    $("stageTitle").textContent = m === "number" && state.qty > 1 && !state.secret ? "Nombres a l’atzar" : TITLES[m];
    $("drawLabel").textContent = m === "number" && state.secret ? "Pensa un nombre secret" : m === "number" && state.qty > 1 ? `Genera ${state.qty} nombres` : LABELS[m];
    const valid = m !== "number" || validateRange();
    $("drawButton").disabled = busy || !valid;
    $("guessBox").hidden = !(m === "number" && secretValue !== null);
    $("qtyValue").textContent = state.secret ? 1 : state.qty;
    $("qtyMinus").disabled = state.secret || state.qty <= 1;
    $("qtyPlus").disabled = state.secret || state.qty >= MAX_QTY;
    $("uniqueToggle").checked = state.unique;
    $("sortToggle").checked = state.sort;
    $("secretToggle").checked = state.secret;
    $("speakToggle").checked = state.speak;
    $("letterUniqueToggle").checked = state.letterUnique;
    $("bingoMax").value = state.bingoMax;
    for (const b of document.querySelectorAll("[data-bingo]")) b.setAttribute("aria-pressed", String(Number(b.dataset.bingo) === state.bingoMax));
    for (const b of document.querySelectorAll("[data-range]")) b.setAttribute("aria-pressed", String(b.dataset.range === `${state.min},${state.max}`));
    $("durationInput").value = String(state.duration);
    $("ideasList").replaceChildren(
      ...IDEAS[m].map(([title, text]) => {
        const li = document.createElement("li"),
          strong = document.createElement("strong");
        strong.textContent = title;
        li.append(strong, ` ${text}`);
        return li;
      }),
    );
  }
  function renderHistory() {
    A.renderHistory($("historyList"), $("historyEmpty"), state.history, $("historyCount"));
    $("exportHistory").disabled = $("clearHistory").disabled = $("copyHistory").disabled = !state.history.length;
  }
  function setMode(mode) {
    if (busy || mode === state.mode) return;
    state.mode = mode;
    secretValue = null;
    setResultLine();
    persist();
    sync();
    if (mode === "bingo") renderBoard();
    A.fitLayout();
    sizeViews();
  }

  for (const b of document.querySelectorAll("[data-mode]")) b.addEventListener("click", () => setMode(b.dataset.mode));
  $("drawButton").addEventListener("click", draw);
  $("numberView").addEventListener("click", () => secretValue === null && draw());
  $("letterTile").addEventListener("click", draw);
  $("bingoBall").addEventListener("click", draw);
  for (const id of ["minInput", "maxInput"])
    $(id).addEventListener("input", () => {
      if (validateRange()) persist();
      sync();
    });
  for (const b of document.querySelectorAll("[data-range]"))
    b.addEventListener("click", () => {
      const [min, max] = b.dataset.range.split(",").map(Number);
      $("minInput").value = min;
      $("maxInput").value = max;
      validateRange();
      persist();
      sync();
    });
  $("qtyMinus").addEventListener("click", () => {
    state.qty = Math.max(1, state.qty - 1);
    persist();
    sync();
  });
  $("qtyPlus").addEventListener("click", () => {
    state.qty = Math.min(MAX_QTY, state.qty + 1);
    persist();
    sync();
  });
  const toggles = { uniqueToggle: "unique", sortToggle: "sort", secretToggle: "secret", speakToggle: "speak", letterUniqueToggle: "letterUnique" };
  for (const [id, key] of Object.entries(toggles))
    $(id).addEventListener("change", (e) => {
      state[key] = e.target.checked;
      if (key === "secret" && !state.secret && secretValue !== null) reveal();
      if (key === "speak" && state.speak) speak("Hola");
      persist();
      sync();
      if (key === "letterUnique") renderLetterChips();
    });
  $("guessForm").addEventListener("submit", guess);
  $("revealButton").addEventListener("click", () => reveal());
  for (const b of document.querySelectorAll("[data-bingo]"))
    b.addEventListener("click", () => {
      state.bingoMax = Number(b.dataset.bingo);
      state.bingoDrawn = state.bingoDrawn.filter((n) => n <= state.bingoMax);
      persist();
      sync();
      renderBoard();
    });
  $("bingoMax").addEventListener("change", (e) => {
    const v = Math.round(Number(e.target.value));
    if (!Number.isFinite(v) || v < 5 || v > 200) {
      A.toast("El bombo pot tenir entre 5 i 200 boles.");
      return sync();
    }
    state.bingoMax = v;
    state.bingoDrawn = state.bingoDrawn.filter((n) => n <= v);
    persist();
    sync();
    renderBoard();
  });
  $("bingoReset").addEventListener("click", () => {
    if (busy) return;
    state.bingoDrawn = [];
    A.toast("Tauler buit. Totes les boles tornen al bombo.");
    persist();
    renderBoard();
  });
  $("lettersEasy").addEventListener("click", () => {
    state.letters = ALPHABET.filter((l) => !UNUSUAL.includes(l));
    persist();
    renderLetterChips();
  });
  $("lettersAll").addEventListener("click", () => {
    state.letters = [...ALPHABET];
    persist();
    renderLetterChips();
  });
  $("lettersReset").addEventListener("click", () => {
    state.usedLetters = [];
    persist();
    renderLetterChips();
    A.toast("Totes les lletres tornen a estar disponibles.");
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
  $("copyHistory").addEventListener("click", () => A.copyText(state.history.map((h) => h.label).reverse().join("\n")));
  $("exportHistory").addEventListener("click", () =>
    A.downloadCsv("nombres-resultats.csv", [
      ["Data", "Hora", "Resultat"],
      ...state.history.map((h) => [new Date(h.time).toLocaleDateString("ca"), A.formatTime(h.time), h.label]),
    ]),
  );
  document.addEventListener("atzar:fit", sizeViews);

  A.init({ onAction: draw, isBusy: () => busy, fit: { min: 220, max: 540 } });
  $("minInput").value = state.min;
  $("maxInput").value = state.max;
  renderBalls(lastNumbers.length ? lastNumbers : [null]);
  renderBoard();
  renderLetterChips();
  if (state.usedLetters.length) $("letterTile").firstElementChild.textContent = state.usedLetters.at(-1);
  sync();
  renderHistory();
})();
