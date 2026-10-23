/* Daus — d'un a sis daus de 4 a 20 cares, amb suma, producte i distribució. */
(() => {
  "use strict";
  const A = window.Atzar,
    $ = A.$;
  const KEY = "felip.atzar.daus.v1",
    MAX_DICE = 6,
    FACES = [4, 6, 8, 10, 12, 20],
    OPS = ["sum", "product", "none"],
    DURATIONS = [700, 1400, 2600];
  const COLORS = ["#d47761", "#5f91a6", "#759479", "#e2ad55", "#817ca6", "#c78294"];
  const COLOR_NAMES = ["vermell", "blau", "verd", "groc", "lila", "rosa"];
  const state = {
    count: 2,
    faces: 6,
    op: "sum",
    colors: true,
    duration: 1400,
    history: [],
    stats: {},
  };
  const saved = A.load(KEY, null);
  if (saved && typeof saved === "object") {
    if (Number.isInteger(saved.count)) state.count = Math.min(MAX_DICE, Math.max(1, saved.count));
    if (FACES.includes(saved.faces)) state.faces = saved.faces;
    if (OPS.includes(saved.op)) state.op = saved.op;
    if (typeof saved.colors === "boolean") state.colors = saved.colors;
    if (DURATIONS.includes(saved.duration)) state.duration = saved.duration;
    if (Array.isArray(saved.history))
      state.history = saved.history
        .filter((h) => h && typeof h.label === "string" && Number.isFinite(h.time))
        .slice(0, 200);
    if (saved.stats && typeof saved.stats === "object") state.stats = saved.stats;
  }
  const persist = () => A.save(KEY, state);
  const configKey = () => `${state.count}d${state.faces}`;

  const host = $("dice");
  let busy = false,
    dice = [];

  /* Geometria */
  const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const FACE_POS = { 1: "translateZ(var(--h))", 2: "rotateX(90deg) translateZ(var(--h))", 3: "rotateY(90deg) translateZ(var(--h))", 4: "rotateY(-90deg) translateZ(var(--h))", 5: "rotateX(-90deg) translateZ(var(--h))", 6: "rotateY(180deg) translateZ(var(--h))" };
  const SHOW = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
  function polygon(n, r = 46, rot = -90) {
    return Array.from({ length: n }, (_, i) => {
      const a = ((rot + (360 / n) * i) * Math.PI) / 180;
      return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  }
  const SHAPES = {
    4: { shape: "50,6 95,86 5,86", edges: "", ty: 62, size: 30 },
    8: { shape: "50,3 95,50 50,97 5,50", edges: "M5 50h90M50 3 26 50 50 97 74 50z", ty: 50, size: 30 },
    10: { shape: "50,3 93,40 50,97 7,40", edges: "M7 40 50 58 93 40M50 58v39", ty: 38, size: 27 },
    12: { shape: polygon(5, 48), edges: `M${polygon(5, 27)}z`, ty: 52, size: 26 },
    20: { shape: polygon(6, 48, -90), edges: "M50 2 91 26 9 26zM50 26 91 74 9 74z", ty: 55, size: 23 },
  };

  function buildDice() {
    host.replaceChildren();
    dice = [];
    for (let i = 0; i < state.count; i++) {
      const die = document.createElement("div");
      die.className = `die${state.colors ? "" : " classic"}`;
      if (state.colors) die.style.setProperty("--c", COLORS[i % COLORS.length]);
      die.innerHTML = '<div class="die-shadow"></div>';
      const item = { el: die, value: 1, x: 0, y: 0 };
      if (state.faces === 6) {
        const cube = document.createElement("div");
        cube.className = "cube";
        cube.innerHTML =
          '<div class="cube-core"></div><div class="cube-core" style="transform:rotateY(90deg)"></div><div class="cube-core" style="transform:rotateX(90deg)"></div>' +
          Object.entries(PIPS)
            .map(([v, pips]) => `<div class="cube-face" data-v="${v}" style="transform:${FACE_POS[v]}">${Array.from({ length: 9 }, (_, k) => (pips.includes(k + 1) ? '<span class="pip"></span>' : "<span></span>")).join("")}</div>`)
            .join("");
        die.append(cube);
        item.body = cube;
        const start = 1 + (i % 6);
        item.value = start;
        [item.x, item.y] = SHOW[start];
        cube.style.transform = `rotateZ(0deg) rotateX(${item.x}deg) rotateY(${item.y}deg)`;
      } else {
        const g = SHAPES[state.faces],
          poly = document.createElement("div");
        poly.className = "poly";
        poly.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><polygon class="shape" points="${g.shape}"/>${g.edges ? `<path class="edges" d="${g.edges}"/>` : ""}<text class="num" x="50" y="${g.ty}" font-size="${g.size}">${state.faces}</text><text class="kind" x="50" y="${state.faces === 4 ? 79 : 86}">D${state.faces}</text></svg>`;
        die.append(poly);
        item.body = poly;
        item.value = state.faces;
      }
      host.append(die);
      dice.push(item);
    }
    setNumberStyle();
    host.setAttribute("aria-label", `${state.count} ${state.count === 1 ? "dau" : "daus"} de ${state.faces} cares`);
    sizeDice();
  }
  function setNumberStyle() {
    for (const d of dice) {
      const text = d.body.querySelector?.(".num");
      if (!text) continue;
      text.textContent = d.value;
      // Subratllat del 6 i el 9 per distingir-los, com als daus reals.
      text.setAttribute("text-decoration", state.faces >= 8 && (d.value === 6 || d.value === 9) ? "underline" : "none");
    }
  }
  function sizeDice() {
    const n = state.count,
      W = host.clientWidth || 300,
      H = host.clientHeight || 300;
    let best = 0;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      best = Math.max(best, Math.min(W / (cols + (cols - 1) * 0.3 + 0.3), H / (rows + (rows - 1) * 0.35 + 0.35)));
    }
    const size = Math.floor(Math.min(best * 0.92, A.cap(210)));
    host.style.setProperty("--die", `${size}px`);
    host.style.setProperty("--die-gap", `${Math.round(size * 0.3)}px`);
    host.style.setProperty("--h", `${size / 2}px`);
  }

  function syncControls() {
    $("countValue").textContent = state.count;
    $("countMinus").disabled = busy || state.count <= 1;
    $("countPlus").disabled = busy || state.count >= MAX_DICE;
    for (const b of document.querySelectorAll("[data-faces]")) {
      b.setAttribute("aria-pressed", String(Number(b.dataset.faces) === state.faces));
      b.disabled = busy;
    }
    for (const b of document.querySelectorAll("[data-op]")) b.setAttribute("aria-pressed", String(b.dataset.op === state.op));
    for (const b of document.querySelectorAll("[data-simulate]")) b.disabled = busy;
    $("colorToggle").checked = state.colors;
    $("durationInput").value = String(state.duration);
    $("rollButton").disabled = busy;
    $("rollLabel").textContent = state.count === 1 ? "Llança el dau" : `Llança ${state.count} daus`;
    $("stageSubtitle").textContent = `${state.count} ${state.count === 1 ? "dau" : "daus"} de ${state.faces} cares${state.count > 1 && state.op !== "none" ? ` · ${state.op === "sum" ? "suma" : "producte"}` : ""}`;
  }

  function describe(values) {
    if (values.length === 1) return String(values[0]);
    if (state.op === "sum") return `${values.join(" + ")} = ${values.reduce((a, b) => a + b, 0)}`;
    if (state.op === "product") return `${values.join(" × ")} = ${values.reduce((a, b) => a * b, 1)}`;
    return values.join(" · ");
  }
  function record(values) {
    const key = configKey(),
      s = (state.stats[key] ||= { rolls: 0, counts: Array(state.count * (state.faces - 1) + 1).fill(0) });
    s.rolls++;
    s.counts[values.reduce((a, b) => a + b, 0) - state.count]++;
  }
  function showResult(values) {
    const line = $("resultLine"),
      big = document.createElement("span");
    big.className = "big";
    big.textContent = describe(values);
    line.replaceChildren(big);
    if (state.colors && values.length > 1 && state.op === "none") {
      const detail = document.createElement("span");
      detail.textContent = values.map((v, i) => `${COLOR_NAMES[i]}: ${v}`).join(" · ");
      line.append(detail);
    }
  }

  function roll() {
    if (busy) return;
    A.audioReady();
    busy = true;
    syncControls();
    $("resultLine").textContent = "";
    const values = dice.map(() => 1 + A.randomInt(state.faces)),
      motion = !A.reduced.matches;
    const done = dice.map((d, i) => {
      d.el.classList.remove("landed");
      const duration = state.duration * (0.9 + A.randomInt(201) / 1000),
        delay = i * 60,
        drift = (A.randomInt(41) - 20) / 100;
      for (let k = 0; k < Math.max(3, Math.round(duration / 160)); k++)
        setTimeout(() => A.noise(0.03, 0, 0.16, 1800 + A.randomInt(1400)), delay + (k * duration * 0.75) / Math.max(3, Math.round(duration / 160)));
      setTimeout(() => A.noise(0.06, 0, 0.3, 1200), delay + duration * 0.85);
      if (state.faces === 6) {
        const [tx, ty] = SHOW[values[i]],
          ox = d.x,
          oy = d.y,
          spins = 2 + Math.round(state.duration / 900),
          x = d.x - (((d.x % 360) + 360) % 360) + 360 * (spins + A.randomInt(2)) + tx,
          y = d.y - (((d.y % 360) + 360) % 360) + 360 * (spins + A.randomInt(2)) + ty,
          z = A.randomInt(31) - 15,
          from = getComputedStyle(d.body).transform === "none" ? "" : d.body.style.transform,
          final = `translate(0, 0) rotateZ(${z}deg) rotateX(${x}deg) rotateY(${y}deg)`;
        d.x = x;
        d.y = y;
        d.value = values[i];
        if (!motion) {
          d.body.style.transform = final;
          return Promise.resolve();
        }
        const start = from.startsWith("translate") ? from : `translate(0, 0) ${from || "rotateZ(0deg) rotateX(0deg) rotateY(0deg)"}`;
        const anim = d.body.animate(
          [
            { transform: start, easing: "cubic-bezier(.25,.7,.45,1)" },
            { transform: `translate(${drift * 100}%, -30%) rotateZ(${z / 2}deg) rotateX(${ox + (x - ox) * 0.6}deg) rotateY(${oy + (y - oy) * 0.6}deg)`, offset: 0.4, easing: "cubic-bezier(.55,0,.8,.45)" },
            { transform: `translate(0, 0) rotateZ(${z}deg) rotateX(${x - 8}deg) rotateY(${y - 6}deg)`, offset: 0.85, easing: "ease-out" },
            { transform: final },
          ],
          { duration, delay, fill: "forwards" },
        );
        return anim.finished.then(() => {
          d.body.style.transform = final;
          anim.cancel();
          d.el.classList.add("landed");
        });
      }
      // Daus polièdrics: rodolen mentre canvien de número i s'aturen al resultat.
      const text = d.body.querySelector(".num"),
        turns = (A.randomInt(2) ? 1 : -1) * (360 * (1 + Math.round(state.duration / 1000)) + A.randomInt(40) - 20);
      if (!motion) {
        d.value = values[i];
        setNumberStyle();
        return Promise.resolve();
      }
      let stop = false;
      (function flicker(wait) {
        if (stop) return;
        d.value = 1 + A.randomInt(state.faces);
        setNumberStyle();
        setTimeout(() => flicker(Math.min(260, wait * 1.12)), wait);
      })(55);
      const anim = d.body.animate(
        [
          { transform: "translate(0,0) rotate(0deg) scale(1)", easing: "cubic-bezier(.25,.7,.45,1)" },
          { transform: `translate(${drift * 100}%, -28%) rotate(${turns * 0.55}deg) scale(1.1)`, offset: 0.42, easing: "cubic-bezier(.55,0,.8,.45)" },
          { transform: `translate(0,0) rotate(${turns * 0.97}deg) scale(1)`, offset: 0.85, easing: "ease-out" },
          { transform: `translate(0,0) rotate(${turns}deg) scale(1)` },
        ],
        { duration, delay },
      );
      return anim.finished.then(() => {
        stop = true;
        d.value = values[i];
        setNumberStyle();
        d.el.classList.add("landed");
      });
    });
    Promise.all(done).then(() => {
      busy = false;
      record(values);
      showResult(values);
      state.history.unshift({ label: describe(values), detail: `${state.count}d${state.faces}`, time: Date.now() });
      state.history.length = Math.min(state.history.length, 200);
      A.sounds.win();
      persist();
      syncControls();
      renderHistory();
      renderStats();
    });
  }

  function simulate(times) {
    if (busy) return;
    let total = 0;
    for (let t = 0; t < times; t++) {
      const values = Array.from({ length: state.count }, () => 1 + A.randomInt(state.faces));
      total += values.reduce((a, b) => a + b, 0);
      record(values);
    }
    const label = `Simulació: ${times.toLocaleString("ca")} tirades de ${configKey().replace("d", "D")} → suma mitjana ${(total / times).toLocaleString("ca", { maximumFractionDigits: 2 })}`;
    state.history.unshift({ label, detail: configKey(), time: Date.now() });
    state.history.length = Math.min(state.history.length, 200);
    persist();
    renderHistory();
    renderStats();
    $("resultLine").textContent = label;
    A.audioReady();
    A.sounds.click();
    A.toast(`${times.toLocaleString("ca")} tirades simulades. Mira l’Estadística.`);
  }

  function theoretical(count, faces) {
    let dist = [1];
    for (let d = 0; d < count; d++) {
      const next = Array(dist.length + faces - 1).fill(0);
      dist.forEach((p, i) => {
        for (let f = 0; f < faces; f++) next[i + f] += p / faces;
      });
      dist = next;
    }
    return dist;
  }
  function renderStats() {
    const s = state.stats[configKey()],
      rolls = s?.rolls || 0,
      expectedMean = (state.count * (state.faces + 1)) / 2;
    $("statRolls").textContent = rolls.toLocaleString("ca");
    $("statConfig").textContent = `${state.count} × D${state.faces}`;
    $("statExpected").textContent = `teòrica ${expectedMean.toLocaleString("ca")}`;
    const fmt = (v) => v.toLocaleString("ca", { maximumFractionDigits: 2 });
    if (!rolls) {
      $("statMean").textContent = "—";
      $("distChart").innerHTML = A.charts.bars({
        labels: theoretical(state.count, state.faces).map((_, i) => String(i + state.count)),
        observed: [],
        expected: theoretical(state.count, state.faces),
        label: "Distribució teòrica",
      }) + A.charts.legend;
      $("distCaption").textContent = `Encara no hi ha tirades amb aquesta configuració. Les marques daurades mostren la probabilitat teòrica de cada ${state.count > 1 ? "suma" : "valor"}.`;
      return;
    }
    const mean = s.counts.reduce((acc, c, i) => acc + c * (i + state.count), 0) / rolls;
    $("statMean").textContent = fmt(mean);
    $("distChart").innerHTML =
      A.charts.bars({
        labels: s.counts.map((_, i) => String(i + state.count)),
        observed: s.counts.map((c) => c / rolls),
        expected: theoretical(state.count, state.faces),
        label: `Distribució de ${state.count > 1 ? "la suma" : "els valors"}`,
      }) + A.charts.legend;
    $("distCaption").textContent = `${state.count > 1 ? "Suma" : "Valor"} de cada tirada amb ${state.count} × D${state.faces}. Les barres són el que ha sortit i les marques daurades, la probabilitat teòrica.`;
  }
  function renderHistory() {
    A.renderHistory($("historyList"), $("historyEmpty"), state.history, $("historyCount"));
    $("exportHistory").disabled = $("clearHistory").disabled = !state.history.length;
  }
  function changed() {
    buildDice();
    syncControls();
    renderStats();
    persist();
  }

  $("rollButton").addEventListener("click", roll);
  host.addEventListener("click", roll);
  $("countMinus").addEventListener("click", () => {
    state.count = Math.max(1, state.count - 1);
    changed();
  });
  $("countPlus").addEventListener("click", () => {
    state.count = Math.min(MAX_DICE, state.count + 1);
    changed();
  });
  for (const b of document.querySelectorAll("[data-faces]"))
    b.addEventListener("click", () => {
      state.faces = Number(b.dataset.faces);
      changed();
    });
  for (const b of document.querySelectorAll("[data-op]"))
    b.addEventListener("click", () => {
      state.op = b.dataset.op;
      syncControls();
      persist();
    });
  $("colorToggle").addEventListener("change", (e) => {
    state.colors = e.target.checked;
    changed();
  });
  $("durationInput").addEventListener("change", (e) => {
    state.duration = Number(e.target.value);
    persist();
  });
  for (const b of document.querySelectorAll("[data-simulate]")) b.addEventListener("click", () => simulate(Number(b.dataset.simulate)));
  $("resetStats").addEventListener("click", () => {
    delete state.stats[configKey()];
    persist();
    renderStats();
    A.toast("Estadística d’aquesta configuració reiniciada.");
  });
  $("clearHistory").addEventListener("click", () => {
    state.history = [];
    persist();
    renderHistory();
  });
  $("exportHistory").addEventListener("click", () =>
    A.downloadCsv("daus-resultats.csv", [
      ["Data", "Hora", "Resultat", "Daus"],
      ...state.history.map((h) => [new Date(h.time).toLocaleDateString("ca"), A.formatTime(h.time), h.label, h.detail || ""]),
    ]),
  );
  document.addEventListener("atzar:fit", sizeDice);

  A.init({ onAction: roll, isBusy: () => busy, fit: { min: 200, max: 520 } });
  buildDice();
  syncControls();
  renderHistory();
  renderStats();
})();
