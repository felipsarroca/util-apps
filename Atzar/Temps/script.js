/* Temps — compte enrere, cronòmetre amb marques i patata calenta. */
(() => {
  "use strict";
  const A = window.Atzar,
    $ = A.$;
  const KEY = "felip.atzar.temps.v1",
    MODES = ["countdown", "stopwatch", "potato"],
    MAX_CD = 3 * 3600 * 1000;
  const TITLES = { countdown: "Compte enrere", stopwatch: "Cronòmetre", potato: "Patata calenta" };
  const IDEAS = {
    countdown: [
      ["Temps de treball visible.", "Una tasca de 10 minuts amb l’anell projectat: quan es torna groc, toca revisar; quan és vermell, tancar."],
      ["1-2-4.", "Un minut de reflexió individual, dos en parella i quatre en grup, amb el compte enrere a cada fase."],
      ["Torns de paraula.", "Un minut per intervenció en un debat o una assemblea; «+1 min» si la conversa ho demana."],
      ["Exposicions orals.", "Tres minuts per exposició: l’alumnat aprèn a ajustar el discurs al temps."],
    ],
    stopwatch: [
      ["Educació física.", "Prem «Marca» quan cada alumne arriba i escriu-hi el nom a la pestanya Marques. Després, exporta-ho."],
      ["El pèndol.", "Cronometra deu oscil·lacions i divideix per deu: és més precís que mesurar-ne una. Canvia la llargada del fil i compara."],
      ["Velocitat.", "Distància ÷ temps amb curses, cotxes de joguina o boles que baixen per un pla inclinat."],
      ["Fluència lectora.", "Un minut de lectura en veu alta i es compten les paraules: el progrés es veu al llarg del curs."],
    ],
    potato: [
      ["Vocabulari.", "Qui té la patata diu una paraula del tema abans de passar-la. Quan explota, qui la té proposa la paraula següent."],
      ["Taules i sèries.", "Cada persona diu el múltiple següent (7, 14, 21…) o el número següent d’una sèrie."],
      ["Llengües.", "Conjugacions, contraris o traduccions encadenades: no es pot repetir cap resposta."],
      ["Repàs en cercle.", "Quan explota, qui té la patata respon una pregunta de repàs (la pot treure de la Ruleta o del Sorteig)."],
    ],
  };
  const state = {
    mode: "countdown",
    cd: { total: 300000, remaining: 300000, endAt: null },
    sw: { base: 0, startAt: null, marks: [] },
    potato: { min: 15, max: 45 },
    endMessage: "",
    tick: true,
    potatoTick: true,
  };
  const saved = A.load(KEY, null);
  if (saved && typeof saved === "object") {
    if (MODES.includes(saved.mode)) state.mode = saved.mode;
    const cd = saved.cd;
    if (cd && Number.isFinite(cd.total) && cd.total > 0 && cd.total <= MAX_CD + 3600000) {
      state.cd.total = cd.total;
      state.cd.remaining = Number.isFinite(cd.remaining) ? Math.max(0, cd.remaining) : cd.total;
      state.cd.endAt = Number.isFinite(cd.endAt) ? cd.endAt : null;
    }
    const sw = saved.sw;
    if (sw && Number.isFinite(sw.base)) {
      state.sw.base = Math.max(0, sw.base);
      state.sw.startAt = Number.isFinite(sw.startAt) ? sw.startAt : null;
      state.sw.marks = Array.isArray(sw.marks) ? sw.marks.filter((m) => m && Number.isFinite(m.t)).map((m) => ({ t: m.t, label: typeof m.label === "string" ? m.label.slice(0, 60) : "" })).slice(0, 500) : [];
    }
    if (saved.potato && Number.isInteger(saved.potato.min) && Number.isInteger(saved.potato.max)) state.potato = { min: saved.potato.min, max: saved.potato.max };
    if (typeof saved.endMessage === "string") state.endMessage = saved.endMessage.slice(0, 60);
    for (const k of ["tick", "potatoTick"]) if (typeof saved[k] === "boolean") state[k] = saved[k];
  }
  const persist = () => A.save(KEY, state);
  // La patata no es desa: la durada secreta només existeix mentre es juga.
  const potato = { endAt: null, remaining: null, startAt: null, playedBase: 0, exploded: false };
  let finished = state.cd.endAt === null && state.cd.remaining === 0,
    lastSecond = null,
    frame,
    potatoTimer;

  /* Format */
  const pad = (n) => String(n).padStart(2, "0");
  function fmtCountdown(ms) {
    const s = Math.ceil(ms / 1000),
      h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
  }
  function fmtStopwatch(ms) {
    const cs = Math.floor(ms / 10),
      s = Math.floor(cs / 100),
      h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)},${Math.floor((cs % 100) / 10)}` : `${pad(m)}:${pad(s % 60)},${pad(cs % 100)}`;
  }
  const cdLeft = () => (state.cd.endAt ? Math.max(0, state.cd.endAt - Date.now()) : state.cd.remaining);
  const swElapsed = () => state.sw.base + (state.sw.startAt ? Date.now() - state.sw.startAt : 0);
  const potatoPlayed = () => potato.playedBase + (potato.startAt ? Date.now() - potato.startAt : 0);
  const running = () => (state.mode === "countdown" ? !!state.cd.endAt : state.mode === "stopwatch" ? !!state.sw.startAt : !!potato.endAt);

  /* Mides */
  function size() {
    const H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--play-height")) || 360,
      W = document.querySelector(".play-area").clientWidth || 320;
    $("clock").style.setProperty("--clock", `${Math.floor(Math.min(H, W, A.cap(600)) * 0.96)}px`);
  }

  /* Pintat */
  function render() {
    const clock = $("clock"),
      m = state.mode;
    let text = "",
      offset = 0,
      note = "";
    clock.classList.toggle("stopwatch", m === "stopwatch");
    clock.classList.toggle("potato-mode", m === "potato");
    $("potato").hidden = m !== "potato";
    if (m === "countdown") {
      const left = cdLeft(),
        frac = state.cd.total ? left / state.cd.total : 0;
      text = fmtCountdown(left);
      offset = 100 * (1 - frac);
      clock.classList.toggle("warn", frac <= 0.2 && frac > 0.1 && left > 0);
      clock.classList.toggle("danger", frac <= 0.1 || (left <= 10000 && left > 0 && !!state.cd.endAt));
      clock.classList.toggle("finished", finished);
      note = finished ? state.endMessage || "S’ha acabat el temps!" : state.cd.endAt ? "" : left < state.cd.total ? "En pausa" : "";
    } else if (m === "stopwatch") {
      const t = swElapsed();
      text = fmtStopwatch(t);
      offset = -((t % 60000) / 600);
      clock.classList.remove("warn", "danger", "finished");
      note = state.sw.startAt ? "" : t ? "Aturat" : "";
    } else {
      const t = potatoPlayed();
      text = potato.exploded || t ? fmtCountdown(t).replace(/^0/, "") : "";
      clock.classList.remove("warn", "danger", "finished");
      clock.classList.toggle("hot", !!potato.endAt);
      clock.classList.toggle("exploded", potato.exploded);
      note = potato.exploded ? "Li toca a qui té la patata!" : potato.endAt ? "Passa la patata!" : t ? "En pausa" : `Explotarà entre ${state.potato.min} i ${state.potato.max} segons`;
      offset = 100;
    }
    $("display").textContent = text;
    $("display").style.setProperty("--digits", text.length <= 5 ? 0.25 : text.length <= 7 ? 0.19 : 0.165);
    $("ringBar").style.setProperty("--offset", offset);
    $("clockNote").textContent = note;
    document.title = running() && m === "countdown" ? `${text} · Temps App` : "Temps App";
  }
  function loop() {
    cancelAnimationFrame(frame);
    check();
    render();
    if (running()) frame = requestAnimationFrame(loop);
  }
  // Comprovació també amb un interval: les pestanyes amagades no reben requestAnimationFrame.
  setInterval(() => running() && (check(), document.hidden && render()), 250);

  function check() {
    if (state.cd.endAt) {
      const left = cdLeft(),
        sec = Math.ceil(left / 1000);
      if (state.tick && sec <= 10 && sec > 0 && sec !== lastSecond && state.mode === "countdown") A.tone(sec <= 3 ? 1046 : 880, 0.06, 0, "sine", 0.12);
      lastSecond = sec;
      if (left <= 0) finishCountdown();
    }
    if (potato.endAt && Date.now() >= potato.endAt) explode();
  }

  /* Compte enrere */
  function finishCountdown() {
    state.cd.endAt = null;
    state.cd.remaining = 0;
    finished = true;
    persist();
    if (state.mode !== "countdown") setMode("countdown", true);
    A.sounds.alarm();
    setTimeout(() => A.sounds.alarm(), 1400);
    $("liveStatus").textContent = state.endMessage || "S’ha acabat el temps!";
    sync();
    render();
  }
  function setDuration(ms) {
    const value = Math.max(1000, Math.min(MAX_CD, ms));
    state.cd = { total: value, remaining: value, endAt: null };
    finished = false;
    persist();
    sync();
    render();
  }

  /* Patata */
  function explode() {
    potato.playedBase = potatoPlayed();
    potato.endAt = null;
    potato.startAt = null;
    potato.exploded = true;
    clearInterval(potatoTimer);
    A.sounds.boom();
    $("liveStatus").textContent = "BUM! Li toca a qui té la patata.";
    sync();
    render();
  }
  function potatoTicking() {
    clearInterval(potatoTimer);
    let odd = false;
    potatoTimer = setInterval(() => {
      if (!potato.endAt || !state.potatoTick) return;
      odd = !odd;
      A.tone(odd ? 1500 : 1150, 0.03, 0, "square", 0.05);
    }, 420);
  }

  /* Accions */
  function main() {
    A.audioReady();
    const now = Date.now();
    if (state.mode === "countdown") {
      if (state.cd.endAt) {
        state.cd.remaining = cdLeft();
        state.cd.endAt = null;
      } else {
        if (finished || state.cd.remaining <= 0) state.cd.remaining = state.cd.total;
        finished = false;
        state.cd.endAt = now + state.cd.remaining;
        lastSecond = null;
        A.sounds.click();
      }
    } else if (state.mode === "stopwatch") {
      if (state.sw.startAt) {
        state.sw.base += now - state.sw.startAt;
        state.sw.startAt = null;
      } else {
        state.sw.startAt = now;
        A.sounds.click();
      }
    } else {
      if (potato.endAt) {
        potato.remaining = potato.endAt - now;
        potato.playedBase = potatoPlayed();
        potato.endAt = potato.startAt = null;
        clearInterval(potatoTimer);
      } else {
        if (potato.exploded || potato.remaining === null) {
          const { min, max } = state.potato;
          potato.remaining = A.randomBetween(min * 1000, max * 1000);
          potato.playedBase = 0;
          potato.exploded = false;
        }
        potato.endAt = now + potato.remaining;
        potato.startAt = now;
        potatoTicking();
        A.sounds.click();
      }
    }
    persist();
    sync();
    loop();
  }
  function reset() {
    if (state.mode === "countdown") {
      state.cd.remaining = state.cd.total;
      state.cd.endAt = null;
      finished = false;
    } else if (state.mode === "stopwatch") {
      state.sw = { base: 0, startAt: null, marks: [] };
      renderMarks();
    } else {
      Object.assign(potato, { endAt: null, remaining: null, startAt: null, playedBase: 0, exploded: false });
      clearInterval(potatoTimer);
    }
    persist();
    sync();
    render();
  }
  function plusMinute() {
    if (state.mode !== "countdown") return;
    if (state.cd.endAt) state.cd.endAt = Math.min(state.cd.endAt + 60000, Date.now() + MAX_CD);
    else {
      if (finished) state.cd.remaining = 0;
      state.cd.remaining = Math.min(state.cd.remaining + 60000, MAX_CD);
    }
    finished = false;
    state.cd.total = Math.max(state.cd.total, cdLeft());
    persist();
    sync();
    render();
  }
  function mark() {
    if (state.mode !== "stopwatch" || !swElapsed()) return;
    state.sw.marks.push({ t: swElapsed(), label: "" });
    A.tone(1200, 0.05, 0, "triangle", 0.15);
    persist();
    renderMarks();
  }

  /* Marques */
  function renderMarks() {
    const marks = state.sw.marks;
    $("marksCount").textContent = marks.length;
    $("marksEmpty").hidden = marks.length > 0;
    $("copyMarks").disabled = $("exportMarks").disabled = $("clearMarks").disabled = !marks.length;
    $("marksList").replaceChildren(
      ...marks.map((m, i) => {
        const li = document.createElement("li"),
          n = document.createElement("span"),
          input = document.createElement("input"),
          times = document.createElement("span"),
          split = document.createElement("small");
        n.className = "number";
        n.textContent = i + 1;
        input.type = "text";
        input.maxLength = 60;
        input.placeholder = "Nom (opcional)";
        input.value = m.label;
        input.setAttribute("aria-label", `Nom de la marca ${i + 1}`);
        input.addEventListener("input", () => {
          m.label = input.value.slice(0, 60);
          persist();
          renderStageMarks();
        });
        times.className = "times";
        times.textContent = fmtStopwatch(m.t);
        split.textContent = `+${fmtStopwatch(m.t - (i ? marks[i - 1].t : 0))}`;
        times.append(split);
        li.append(n, input, times);
        return li;
      }),
    );
    renderStageMarks();
  }
  function renderStageMarks() {
    const host = $("stageMarks"),
      marks = state.sw.marks;
    host.hidden = state.mode !== "stopwatch" || !marks.length;
    host.replaceChildren(
      ...marks
        .slice(-6)
        .reverse()
        .map((m) => {
          const li = document.createElement("li"),
            b = document.createElement("b"),
            i = marks.indexOf(m);
          b.textContent = m.label || `#${i + 1}`;
          li.append(b, fmtStopwatch(m.t));
          return li;
        }),
    );
    A.fitLayout();
  }
  function marksRows() {
    return state.sw.marks.map((m, i) => [i + 1, m.label, fmtStopwatch(m.t), fmtStopwatch(m.t - (i ? state.sw.marks[i - 1].t : 0))]);
  }

  /* Interfície */
  function sync() {
    const m = state.mode,
      run = running();
    for (const b of document.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === m));
    $("stageTitle").textContent = TITLES[m];
    $("countdownOptions").hidden = m !== "countdown";
    $("stopwatchOptions").hidden = m !== "stopwatch";
    $("potatoOptions").hidden = m !== "potato";
    $("plusButton").hidden = m !== "countdown";
    $("markButton").hidden = m !== "stopwatch";
    $("markButton").disabled = !swElapsed();
    let label;
    if (m === "countdown") label = state.cd.endAt ? "Pausa" : finished ? "Torna a començar" : state.cd.remaining < state.cd.total ? "Continua" : "Comença";
    else if (m === "stopwatch") label = state.sw.startAt ? "Atura" : swElapsed() ? "Continua" : "Comença";
    else label = potato.endAt ? "Pausa" : potato.exploded ? "Una altra ronda" : potato.remaining !== null ? "Continua" : "Encén la patata";
    $("startLabel").textContent = label;
    $("startIcon").textContent = run ? "❚❚" : "▶";
    const cdSeconds = Math.round(state.cd.total / 1000);
    if (document.activeElement !== $("minutesInput")) $("minutesInput").value = Math.floor(cdSeconds / 60);
    if (document.activeElement !== $("secondsInput")) $("secondsInput").value = cdSeconds % 60;
    for (const b of document.querySelectorAll("[data-preset]")) b.setAttribute("aria-pressed", String(Number(b.dataset.preset) * 1000 === state.cd.total));
    for (const id of ["minutesInput", "secondsInput"]) $(id).disabled = !!state.cd.endAt;
    for (const b of document.querySelectorAll("[data-preset]")) b.disabled = !!state.cd.endAt;
    $("endMessage").value = state.endMessage;
    $("potatoMin").value = state.potato.min;
    $("potatoMax").value = state.potato.max;
    $("potatoMin").disabled = $("potatoMax").disabled = !!potato.endAt;
    $("tickToggle").checked = state.tick;
    $("potatoTickToggle").checked = state.potatoTick;
    $("ideasList").replaceChildren(
      ...IDEAS[m].map(([title, text]) => {
        const li = document.createElement("li"),
          strong = document.createElement("strong");
        strong.textContent = title;
        li.append(strong, ` ${text}`);
        return li;
      }),
    );
    renderStageMarks();
  }
  function setMode(mode, keepCountdown = false) {
    if (mode === state.mode) return;
    if (state.mode === "potato" && potato.endAt) main(); // pausa la patata en sortir
    state.mode = mode;
    if (!keepCountdown && mode !== "countdown" && finished) finished = false;
    persist();
    sync();
    loop();
    A.fitLayout();
  }

  for (const b of document.querySelectorAll("[data-mode]")) b.addEventListener("click", () => setMode(b.dataset.mode));
  $("startButton").addEventListener("click", main);
  $("clock").addEventListener("click", main);
  $("resetButton").addEventListener("click", reset);
  $("plusButton").addEventListener("click", plusMinute);
  $("markButton").addEventListener("click", mark);
  for (const b of document.querySelectorAll("[data-preset]")) b.addEventListener("click", () => setDuration(Number(b.dataset.preset) * 1000));
  for (const id of ["minutesInput", "secondsInput"])
    $(id).addEventListener("change", () => {
      const min = Math.max(0, Math.min(180, Math.floor(Number($("minutesInput").value) || 0))),
        sec = Math.max(0, Math.min(59, Math.floor(Number($("secondsInput").value) || 0)));
      setDuration((min * 60 + sec) * 1000);
    });
  $("endMessage").addEventListener("input", (e) => {
    state.endMessage = e.target.value.slice(0, 60);
    persist();
    render();
  });
  for (const id of ["potatoMin", "potatoMax"])
    $(id).addEventListener("change", () => {
      let min = Math.floor(Number($("potatoMin").value)),
        max = Math.floor(Number($("potatoMax").value));
      if (!Number.isFinite(min) || min < 3) min = 3;
      if (!Number.isFinite(max) || max > 900) max = 900;
      if (max <= min) max = min + 1;
      state.potato = { min, max };
      $("potatoNote").textContent = `La patata explotarà en un moment qualsevol entre ${min} i ${max} segons.`;
      Object.assign(potato, { remaining: null, exploded: false, playedBase: 0 });
      persist();
      sync();
      render();
    });
  $("tickToggle").addEventListener("change", (e) => {
    state.tick = e.target.checked;
    persist();
  });
  $("potatoTickToggle").addEventListener("change", (e) => {
    state.potatoTick = e.target.checked;
    persist();
  });
  $("clearMarks").addEventListener("click", () => {
    state.sw.marks = [];
    persist();
    renderMarks();
  });
  $("copyMarks").addEventListener("click", () => A.copyText(marksRows().map(([n, label, t, split]) => `${n}. ${label ? `${label} · ` : ""}${t} (+${split})`).join("\n")));
  $("exportMarks").addEventListener("click", () => A.downloadCsv("cronometre-marques.csv", [["Núm.", "Nom", "Temps total", "Parcial"], ...marksRows()]));
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || document.querySelector("dialog[open]") || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === "m" || e.key === "M") mark();
    if (e.key === "r" || e.key === "R") reset();
  });
  document.addEventListener("atzar:fit", size);
  document.addEventListener("visibilitychange", () => !document.hidden && loop());

  A.init({ onAction: main, fit: { min: 240, max: 600 } });
  sync();
  renderMarks();
  loop();
})();
