/* Moneda — llançament d'una a deu monedes amb estadística acumulada. */
(() => {
  "use strict";
  const A = window.Atzar,
    $ = A.$;
  const KEY = "felip.atzar.moneda.v1",
    MAX_COINS = 10,
    MAX_SEQ = 50000;
  const DURATIONS = [900, 1700, 3000];
  const state = {
    count: 1,
    labels: { cara: "", creu: "" },
    duration: 1700,
    history: [],
    stats: { total: 0, heads: 0, seq: "", dist: {} },
  };
  const saved = A.load(KEY, null);
  if (saved && typeof saved === "object") {
    if (Number.isInteger(saved.count))
      state.count = Math.min(MAX_COINS, Math.max(1, saved.count));
    for (const side of ["cara", "creu"])
      if (typeof saved.labels?.[side] === "string")
        state.labels[side] = saved.labels[side].slice(0, 40);
    if (DURATIONS.includes(saved.duration)) state.duration = saved.duration;
    if (Array.isArray(saved.history))
      state.history = saved.history
        .filter((h) => h && typeof h.label === "string" && Number.isFinite(h.time))
        .slice(0, 200);
    const s = saved.stats;
    if (s && Number.isInteger(s.total) && Number.isInteger(s.heads) && s.heads <= s.total)
      state.stats = {
        total: s.total,
        heads: s.heads,
        seq: typeof s.seq === "string" ? s.seq.replace(/[^HT]/g, "").slice(-MAX_SEQ) : "",
        dist: s.dist && typeof s.dist === "object" ? s.dist : {},
      };
  }
  const persist = () => A.save(KEY, state);

  const coinsHost = $("coins");
  let busy = false,
    angles = [];

  function plural(n, one, many) {
    return `${n.toLocaleString("ca")} ${n === 1 ? one : many}`;
  }
  function buildCoins() {
    coinsHost.replaceChildren();
    angles = [];
    for (let i = 0; i < state.count; i++) {
      const coin = document.createElement("div");
      coin.className = "coin";
      coin.innerHTML =
        '<div class="coin-shadow"></div><div class="coin-flip"><svg class="face face-cara" viewBox="0 0 100 100"><use href="#coin-cara"/></svg><svg class="face face-creu" viewBox="0 0 100 100"><use href="#coin-creu"/></svg></div>';
      coinsHost.append(coin);
      angles.push(0);
    }
    coinsHost.setAttribute("aria-label", plural(state.count, "moneda", "monedes"));
    sizeCoins();
  }
  function sizeCoins() {
    const n = state.count,
      W = coinsHost.clientWidth || 300,
      H = coinsHost.clientHeight || 300;
    let best = 0;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols),
        size = Math.min(W / (cols + (cols - 1) * 0.16), H / (rows + (rows - 1) * 0.16 + 0.12));
      best = Math.max(best, size);
    }
    const size = Math.floor(Math.min(best * 0.9, A.cap(300)));
    coinsHost.style.setProperty("--coin", `${size}px`);
    coinsHost.style.setProperty("--coin-gap", `${Math.round(size * 0.16)}px`);
  }
  function syncControls() {
    $("countValue").textContent = state.count;
    $("countMinus").disabled = busy || state.count <= 1;
    $("countPlus").disabled = busy || state.count >= MAX_COINS;
    $("tossLabel").textContent = state.count === 1 ? "Llança la moneda" : `Llança ${state.count} monedes`;
    $("tossButton").disabled = busy;
    $("stageSubtitle").textContent =
      state.count === 1 ? "Una moneda, dues cares" : `${state.count} monedes alhora`;
    $("labelCara").value = state.labels.cara;
    $("labelCreu").value = state.labels.creu;
    $("durationInput").value = String(state.duration);
    for (const b of document.querySelectorAll("[data-simulate]")) b.disabled = busy;
  }

  function describe(results) {
    const heads = results.filter((r) => r === "H").length,
      tails = results.length - heads;
    if (results.length === 1) return heads ? "Cara" : "Creu";
    return `${plural(heads, "cara", "cares")} · ${plural(tails, "creu", "creus")}`;
  }
  function record(results) {
    const heads = results.filter((r) => r === "H").length,
      st = state.stats;
    st.total += results.length;
    st.heads += heads;
    st.seq = (st.seq + results.join("")).slice(-MAX_SEQ);
    const dist = (st.dist[results.length] ||= Array(results.length + 1).fill(0));
    dist[heads]++;
  }
  function showResult(results) {
    const line = $("resultLine"),
      big = document.createElement("span");
    big.className = "big";
    big.textContent = describe(results);
    line.replaceChildren(big);
    if (results.length === 1) {
      const meaning = state.labels[results[0] === "H" ? "cara" : "creu"];
      if (meaning) {
        const m = document.createElement("span");
        m.className = "meaning";
        m.textContent = `→ ${meaning}`;
        line.append(m);
      }
    }
  }

  function toss() {
    if (busy) return;
    A.audioReady();
    busy = true;
    syncControls();
    const results = Array.from({ length: state.count }, () => (A.randomInt(2) ? "T" : "H"));
    const coins = [...coinsHost.children],
      motion = !A.reduced.matches,
      base = state.duration;
    $("resultLine").textContent = "";
    A.tone(1400, 0.08, 0, "triangle", 0.12);
    const finished = coins.map((coin, i) => {
      const flip = coin.querySelector(".coin-flip"),
        shadow = coin.querySelector(".coin-shadow");
      coin.classList.remove("landed", "is-cara", "is-creu");
      const from = angles[i],
        turns = 4 + A.randomInt(3) + Math.round(base / 900),
        target = results[i] === "H" ? 0 : 180,
        to = from - (from % 360) + turns * 360 + target;
      angles[i] = to;
      const final = `translateY(0) rotateX(${to}deg)`;
      coin.style.setProperty("--final", final);
      if (!motion) {
        flip.style.transform = final;
        return Promise.resolve();
      }
      const duration = base * (0.94 + A.randomInt(121) / 1000),
        delay = i * 70;
      const anim = flip.animate(
        [
          { transform: `translateY(0) rotateX(${from}deg) scale(1)`, easing: "cubic-bezier(.2,.7,.4,1)" },
          { transform: `translateY(-38%) rotateX(${from + (to - from) * 0.55}deg) scale(1.14)`, offset: 0.45, easing: "cubic-bezier(.6,0,.85,.4)" },
          { transform: `translateY(0) rotateX(${to}deg) scale(1)`, offset: 0.86, easing: "ease-out" },
          { transform: `translateY(-5%) rotateX(${to}deg) scale(1)`, offset: 0.93, easing: "ease-in" },
          { transform: final, offset: 1 },
        ],
        { duration, delay, fill: "forwards" },
      );
      shadow.animate(
        [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.55)", opacity: 0.45, offset: 0.45 }, { transform: "scale(1)", opacity: 1, offset: 0.86 }, { transform: "scale(1)", opacity: 1 }],
        { duration, delay },
      );
      setTimeout(() => A.noise(0.05, 0, 0.22, 3200 + i * 150), delay + duration * 0.86);
      return anim.finished.then(() => {
        flip.style.transform = final;
        anim.cancel();
        coin.classList.add("landed", results[i] === "H" ? "is-cara" : "is-creu");
      });
    });
    Promise.all(finished).then(() => {
      busy = false;
      record(results);
      showResult(results);
      state.history.unshift({ label: describe(results), detail: results.join(""), time: Date.now() });
      state.history.length = Math.min(state.history.length, 200);
      if (state.count === 1) A.tone(results[0] === "H" ? 880 : 660, 0.25, 0, "sine", 0.12);
      else A.sounds.win();
      persist();
      syncControls();
      renderHistory();
      renderStats();
    });
  }

  function simulate(times) {
    if (busy) return;
    let heads = 0;
    for (let t = 0; t < times; t++) {
      const results = Array.from({ length: state.count }, () => (A.randomInt(2) ? "T" : "H"));
      heads += results.filter((r) => r === "H").length;
      record(results);
    }
    const coins = times * state.count;
    const label = `Simulació: ${times.toLocaleString("ca")} tirades × ${plural(state.count, "moneda", "monedes")} → ${A.pct(heads / coins, 1)} de cares`;
    state.history.unshift({ label, detail: `${heads}/${coins}`, time: Date.now() });
    state.history.length = Math.min(state.history.length, 200);
    persist();
    renderHistory();
    renderStats();
    $("resultLine").textContent = label;
    A.audioReady();
    A.sounds.click();
    A.toast(`${coins.toLocaleString("ca")} monedes simulades. Mira l’Estadística.`);
  }

  function binomial(n) {
    const row = [1];
    for (let k = 1; k <= n; k++) row[k] = (row[k - 1] * (n - k + 1)) / k;
    return row.map((c) => c / 2 ** n);
  }
  function renderStats() {
    const { total, heads, seq, dist } = state.stats;
    $("statTotal").textContent = total.toLocaleString("ca");
    $("statCara").textContent = heads.toLocaleString("ca");
    $("statCreu").textContent = (total - heads).toLocaleString("ca");
    $("statCaraPct").textContent = total ? A.pct(heads / total, 1) : "—";
    $("statCreuPct").textContent = total ? A.pct((total - heads) / total, 1) : "—";
    // Recorregut acumulat sobre la seqüència desada (fins a 50.000 monedes).
    const points = [],
      n = seq.length,
      every = Math.max(1, Math.floor(n / 300));
    let h = 0;
    for (let i = 0; i < n; i++) {
      if (seq[i] === "H") h++;
      if ((i + 1) % every === 0 || i === n - 1) points.push([i + 1, h / (i + 1)]);
    }
    $("convergenceChart").innerHTML = A.charts.line({
      points,
      xMax: Math.max(10, n),
      label: "Evolució del percentatge de cares",
    });
    const counts = dist[state.count];
    const tirades = counts ? counts.reduce((a, b) => a + b, 0) : 0;
    $("distWrap").hidden = state.count < 2 || !tirades;
    if (state.count >= 2 && tirades) {
      const labels = counts.map((_, k) => String(k));
      $("distChart").innerHTML =
        A.charts.bars({
          labels,
          observed: counts.map((c) => c / tirades),
          expected: binomial(state.count),
          label: `Nombre de cares en tirades de ${state.count} monedes`,
        }) + A.charts.legend;
      $("distCaption").textContent = `Nombre de cares en cada tirada de ${state.count} monedes (${plural(tirades, "tirada", "tirades")}). Les marques daurades són la probabilitat teòrica.`;
    }
  }
  function renderHistory() {
    A.renderHistory($("historyList"), $("historyEmpty"), state.history, $("historyCount"));
    $("exportHistory").disabled = $("clearHistory").disabled = !state.history.length;
  }

  $("tossButton").addEventListener("click", toss);
  coinsHost.addEventListener("click", toss);
  $("countMinus").addEventListener("click", () => {
    state.count = Math.max(1, state.count - 1);
    buildCoins();
    syncControls();
    renderStats();
    persist();
  });
  $("countPlus").addEventListener("click", () => {
    state.count = Math.min(MAX_COINS, state.count + 1);
    buildCoins();
    syncControls();
    renderStats();
    persist();
  });
  for (const side of ["cara", "creu"]) {
    const input = $(side === "cara" ? "labelCara" : "labelCreu");
    input.addEventListener("input", () => {
      state.labels[side] = input.value.slice(0, 40);
      persist();
    });
  }
  $("durationInput").addEventListener("change", (e) => {
    state.duration = Number(e.target.value);
    persist();
  });
  for (const b of document.querySelectorAll("[data-simulate]"))
    b.addEventListener("click", () => simulate(Number(b.dataset.simulate)));
  $("resetStats").addEventListener("click", () => {
    state.stats = { total: 0, heads: 0, seq: "", dist: {} };
    persist();
    renderStats();
    A.toast("Estadística reiniciada.");
  });
  $("clearHistory").addEventListener("click", () => {
    state.history = [];
    persist();
    renderHistory();
  });
  $("exportHistory").addEventListener("click", () =>
    A.downloadCsv("moneda-resultats.csv", [
      ["Data", "Hora", "Resultat", "Detall (H = cara, T = creu)"],
      ...state.history.map((h) => [
        new Date(h.time).toLocaleDateString("ca"),
        A.formatTime(h.time),
        h.label,
        h.detail || "",
      ]),
    ]),
  );
  document.addEventListener("atzar:fit", sizeCoins);

  A.init({ onAction: toss, isBusy: () => busy, fit: { min: 200, max: 560 } });
  buildCoins();
  syncControls();
  renderHistory();
  renderStats();
})();
