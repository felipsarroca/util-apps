/* Ruleta — sense dependències ni peticions de xarxa. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2,
    KEY = "felip.ruleta.v2";
  const DEFAULTS = [
    "Anna",
    "Biel",
    "Clàudia",
    "David",
    "Emma",
    "Guillem",
    "Júlia",
    "Marc",
  ];
  const PALETTES = {
    festival: [
      "#d47761",
      "#e2ad55",
      "#759479",
      "#5f91a6",
      "#817ca6",
      "#c78294",
      "#519b92",
      "#ac975d",
    ],
    ocean: ["#467f91", "#77b6bc", "#5b96b1", "#87aaa1", "#647fa5", "#81a8c5"],
    earth: ["#b77e62", "#d4ab75", "#87916a", "#bc9465", "#9c786d", "#839b81"],
  };
  const normalize = (a) => ((a % TAU) + TAU) % TAU;
  function randomInt(n) {
    const max = 0x100000000 - (0x100000000 % n),
      a = new Uint32Array(1);
    do {
      crypto.getRandomValues(a);
    } while (a[0] >= max);
    return a[0] % n;
  }
  function parse(raw) {
    return raw
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  function validEntries(a) {
    return (
      Array.isArray(a) &&
      a.length <= 200 &&
      a.every(
        (x) =>
          typeof x === "string" &&
          x.trim().length > 0 &&
          x.length <= 80 &&
          !/[\r\n]/.test(x),
      )
    );
  }
  let state = {
    entries: [...DEFAULTS],
    base: [...DEFAULTS],
    history: [],
    title: "",
    duration: 6,
    palette: "festival",
    volume: 45,
    muted: false,
    noRepeat: false,
    confetti: true,
    dark: false,
    activity: null,
    classes: [],
    favorites: [],
  };
  let loadFailed = false;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) {
      if (!validEntries(saved.entries) || !validEntries(saved.base))
        throw Error("Invalid data");
      if (
        saved.activity &&
        typeof saved.activity.title === "string" &&
        typeof saved.activity.instructions === "string"
      )
        state.activity = {
          title: saved.activity.title.slice(0, 70),
          instructions: saved.activity.instructions.slice(0, 2000),
        };
      state.classes = Array.isArray(saved.classes)
        ? saved.classes
            .filter(
              (c) =>
                c &&
                typeof c.id === "string" &&
                typeof c.name === "string" &&
                c.name.trim() &&
                c.name.length <= 40 &&
                validEntries(c.entries) &&
                c.entries.length,
            )
            .slice(0, 50)
        : [];
      state.favorites = Array.isArray(saved.favorites)
        ? [
            ...new Set(saved.favorites.filter((id) => typeof id === "string")),
          ].slice(0, 100)
        : [];
      state.entries = saved.entries;
      state.base = saved.base;
      state.history = Array.isArray(saved.history)
        ? saved.history
            .filter(
              (x) =>
                x &&
                typeof x.name === "string" &&
                x.name.length <= 80 &&
                Number.isFinite(x.time),
            )
            .slice(0, 200)
        : [];
      if (typeof saved.title === "string")
        state.title = saved.title.slice(0, 70);
      if ([3, 6, 10].includes(saved.duration)) state.duration = saved.duration;
      if (Object.hasOwn(PALETTES, saved.palette)) state.palette = saved.palette;
      if (Number.isFinite(saved.volume))
        state.volume = Math.max(0, Math.min(100, saved.volume));
      for (const key of ["muted", "noRepeat", "confetti", "dark"])
        if (typeof saved[key] === "boolean") state[key] = saved[key];
    }
  } catch {
    loadFailed = true;
  }
  const canvas = $("wheelCanvas"),
    ctx = canvas.getContext("2d"),
    dialog = $("winnerDialog");
  let spinning = false,
    rotation = 0,
    winnerIndex = null,
    undoState = null,
    invalidDraft = false,
    toastTimer,
    audioContext,
    master,
    editingList = false,
    renderAbsents = () => {};
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  // Les opcions de la roda, sense els absents d'avui (compartits amb Sorteig i Equips).
  const wheel = () =>
    window.Atzar ? window.Atzar.present(state.entries) : state.entries;
  function toast(message) {
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 4500);
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      $("saveStatus").textContent = "● Desat només en aquest navegador";
      return true;
    } catch {
      $("saveStatus").textContent =
        "No s’ha pogut desar. Desa una còpia per conservar-ho.";
      return false;
    }
  }
  function checkpoint() {
    undoState = {
      entries: [...state.entries],
      base: [...state.base],
      title: state.title,
      activity: state.activity ? { ...state.activity } : null,
      history: state.history.map((x) => ({ ...x })),
    };
  }
  function syncInput() {
    $("entriesInput").value = state.entries.join("\n");
    invalidDraft = false;
    feedback();
  }
  function feedback() {
    const a = parse($("entriesInput").value);
    invalidDraft = a.length > 200 || a.some((x) => x.length > 80);
    const dupes = a.length - new Set(a).size;
    $("entryFeedback").textContent = invalidDraft
      ? "Màxim 200 opcions i 80 caràcters per línia. Corregeix la llista per girar."
      : !a.length
        ? "Afegeix una opció per començar."
        : dupes
          ? `${dupes} ${dupes === 1 ? "línia duplicada" : "línies duplicades"}: els noms repetits tenen més oportunitats.`
          : a.length > 48
            ? "Llista llarga: numeració de línia de referència als sectors."
            : "";
    $("entryFeedback").classList.toggle("error", invalidDraft);
    $("entriesInput").setAttribute("aria-invalid", String(invalidDraft));
  }
  function refresh() {
    const onWheel = wheel().length,
      away = state.entries.length - onWheel;
    $("entryCount").textContent = state.entries.length;
    $("historyCount").textContent = state.history.length;
    $("availableCount").textContent =
      `${onWheel} ${onWheel === 1 ? "opció disponible" : "opcions disponibles"}${away ? ` · ${away} ${away === 1 ? "absent" : "absents"}` : ""}`;
    $("spinLabel").textContent = spinning
      ? "Girant…"
      : onWheel
        ? "Gira la ruleta"
        : "Afegeix opcions";
    $("spinButton").disabled = $("hubButton").disabled =
      spinning || invalidDraft || !onWheel;
    for (const id of [
      "entriesInput",
      "libraryButton",
      "editListButton",
      "shuffleButton",
      "dedupeButton",
      "clearButton",
      "restoreButton",
      "importButton",
      "noRepeatToggle",
      "durationInput",
      "paletteInput",
      "clearHistoryButton",
    ])
      $(id).disabled = spinning;
    $("undoButton").disabled = spinning || !undoState;
    $("exportButton").disabled = invalidDraft;
    $("stageSubtitle").textContent =
      onWheel === 1
        ? "Només queda una opció. L’última també compta!"
        : "";
    $("exportHistoryButton").disabled = !state.history.length;
    renderRoster();
    for (const button of $("classList").querySelectorAll("button"))
      button.disabled = spinning;
    $("saveClassButton").disabled =
      spinning || invalidDraft || !state.base.length;
    $("className").disabled = spinning;
  }
  // Fit labels to the usable wedge, leaving room for the hub and sector borders.
  function wheelLabel(text, radius, count, baseFont, pixelRatio) {
    const padding = Math.max(2 * pixelRatio, radius * 0.012);
    const hub = Math.max(radius * 0.24, 22 * pixelRatio + padding);
    if (count > 2) {
      baseFont = Math.min(
        baseFont,
        (radius * 0.62 * Math.tan(Math.PI / count) - padding) / 0.7,
      );
    }
    const minimum = Math.min(
      baseFont,
      Math.max(11 * pixelRatio, baseFont * 0.74),
    );
    const words = text.trim().split(/\s+/u);
    const setFont = (font) => {
      ctx.font = `650 ${font}px Segoe UI, sans-serif`;
    };
    function area(font, lines) {
      const extent = font * (lines === 2 ? 1.29 : 0.7);
      const right = Math.min(
        radius * 0.9,
        Math.sqrt(Math.max(0, (radius - padding) ** 2 - extent ** 2)),
      );
      const left = Math.max(
        hub,
        count > 2 ? (extent + padding) / Math.tan(Math.PI / count) : hub,
      );
      return { right, width: Math.max(0, right - left) };
    }
    function wrap(width) {
      let best = null;
      for (let split = 1; split < words.length; split++) {
        const lines = [
          words.slice(0, split).join(" "),
          words.slice(split).join(" "),
        ];
        const widths = lines.map((line) => ctx.measureText(line).width);
        if (Math.max(...widths) <= width) {
          const balance = Math.abs(widths[0] - widths[1]);
          if (!best || balance < best.balance) best = { lines, balance };
        }
      }
      return best?.lines;
    }
    // Prefer a complete label; reduce at most 26%, never below 11 CSS px
    // unless the original type is already smaller in a densely populated wheel.
    for (let attempt = 0; attempt <= 6; attempt++) {
      const font = baseFont - ((baseFont - minimum) * attempt) / 6;
      setFont(font);
      const single = area(font, 1);
      if (ctx.measureText(text).width <= single.width)
        return { font, lines: [text], right: single.right };
      const double = area(font, 2);
      const lines = wrap(double.width);
      if (lines) return { font, lines, right: double.right };
    }
    setFont(minimum);
    const segmenter = Intl.Segmenter
      ? new Intl.Segmenter("ca", { granularity: "grapheme" })
      : null;
    function shorten(value, width) {
      if (ctx.measureText(value).width <= width) return value;
      const chars = segmenter
        ? Array.from(segmenter.segment(value), (part) => part.segment)
        : Array.from(value);
      while (
        chars.length &&
        ctx.measureText(chars.join("") + "…").width > width
      )
        chars.pop();
      return chars.length
        ? chars.join("").trimEnd() + "…"
        : ctx.measureText("…").width <= width
          ? "…"
          : "";
    }
    const single = area(minimum, 1);
    const fallback = {
      font: minimum,
      lines: [shorten(text, single.width)],
      right: single.right,
    };
    const double = area(minimum, 2);
    // Only use two shortened lines if they reveal more of the original wording.
    for (let split = 1; split < words.length; split++) {
      const first = words.slice(0, split).join(" ");
      if (ctx.measureText(first).width > double.width) break;
      const second = shorten(words.slice(split).join(" "), double.width);
      if (!second) continue;
      if (first.length + second.length > fallback.lines.join("").length) {
        fallback.lines = [first, second];
        fallback.right = double.right;
      }
    }
    return fallback;
  }
  function drawWheel() {
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(
      1,
      Math.round(rect.width * Math.min(devicePixelRatio || 1, 3)),
    );
    canvas.width = canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    const entries = wheel(),
      r = size / 2,
      n = entries.length,
      colors = PALETTES[state.palette];
    if (!n) {
      ctx.fillStyle = state.dark ? "#304d3d" : "#e6e9df";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = state.dark ? "#edf2e8" : "#65736c";
      ctx.font = `600 ${size * 0.043}px Segoe UI, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Afegeix les teves opcions", 0, r * 0.48);
    } else {
      const step = TAU / n;
      entries.forEach((entry, i) => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, i * step, (i + 1) * step);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.strokeStyle = "#ffffff55";
        ctx.lineWidth = Math.max(1, size / 700);
        ctx.stroke();
        if (n > 48 && i % Math.ceil(n / 40) !== 0) return;
        ctx.save();
        ctx.rotate((i + 0.5) * step);
        // At high counts, numbers remain legible and refer to the ordered input list.
        const font =
          n > 48
            ? size * 0.028
            : Math.min(size * 0.043, Math.max(size * 0.021, (size * 1.55) / n));
        const label =
          n > 48
            ? { font, lines: [String(i + 1)], right: r * 0.89 }
            : wheelLabel(entry, r, n, font, size / rect.width);
        ctx.font = `650 ${label.font}px Segoe UI, sans-serif`;
        ctx.fillStyle = "#122b29";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        if (n <= 48) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, r, -step / 2, step / 2);
          ctx.closePath();
          ctx.clip();
        }
        label.lines.forEach((line, index) => {
          const y = (index - (label.lines.length - 1) / 2) * label.font * 1.18;
          ctx.fillText(line, label.right, y);
        });
        ctx.restore();
      });
    }
    ctx.restore();
    canvas.style.transform = `rotate(${rotation}rad)`;
  }
  function renderHistory() {
    $("historyList").replaceChildren();
    $("historyEmpty").hidden = state.history.length > 0;
    state.history.forEach((h, i) => {
      const li = document.createElement("li"),
        num = document.createElement("span"),
        name = document.createElement("strong"),
        time = document.createElement("time");
      num.className = "number";
      num.textContent = String(state.history.length - i).padStart(2, "0");
      name.textContent = h.name;
      time.dateTime = new Date(h.time).toISOString();
      time.textContent = new Date(h.time).toLocaleTimeString("ca-ES", {
        hour: "2-digit",
        minute: "2-digit",
      });
      time.title = new Date(h.time).toLocaleString("ca-ES");
      li.append(num, name, time);
      $("historyList").append(li);
    });
  }
  function changed({ base = false } = {}) {
    winnerIndex = null;
    rotation = 0;
    if (base) state.base = [...state.entries];
    renderAbsents();
    applySettings();
    syncInput();
    drawWheel();
    renderHistory();
    refresh();
    save();
  }
  function audioReady() {
    try {
      if (!audioContext) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        audioContext = new Audio();
        master = audioContext.createGain();
        master.connect(audioContext.destination);
      }
      master.gain.setValueAtTime(
        state.muted ? 0 : state.volume / 100,
        audioContext.currentTime,
      );
      if (audioContext.state === "suspended")
        audioContext.resume().catch(() => {});
    } catch {
      /* Audio unavailability never blocks a draw. */
    }
  }
  function tone(freq, duration, delay = 0, type = "sine", level = 0.18) {
    if (!audioContext || !master || state.muted || document.hidden) return;
    const t = audioContext.currentTime + delay,
      osc = audioContext.createOscillator(),
      gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  function tick() {
    tone(950, 0.035, 0, "triangle", 0.24);
    const p = document.querySelector(".pointer");
    p.classList.remove("tick");
    void p.offsetWidth;
    p.classList.add("tick");
  }
  function spin() {
    if (
      spinning ||
      invalidDraft ||
      !wheel().length ||
      dialog.open ||
      $("libraryDialog").open
    )
      return;
    audioReady();
    checkpoint();
    editingList = false;
    spinning = true;
    refresh();
    const n = wheel().length,
      index = randomInt(n),
      step = TAU / n;
    // Pick the winner uniformly first; stop strictly inside that sector, never on a boundary.
    const offset = 0.3 + randomInt(4001) / 10000;
    const finalAngle = normalize(-Math.PI / 2 - (index + offset) * step);
    const start = rotation,
      target =
        start +
        (5 + randomInt(3)) * TAU +
        normalize(finalAngle - normalize(start));
    // A tiny timing variation keeps successive spins from feeling mechanical.
    // These draws affect the animation only, never the already selected winner.
    const durationJitter = 0.98 + randomInt(4001) / 100000;
    const brakingPower = 2.12 + randomInt(6001) / 100000;
    const duration = reduced.matches
        ? 180
        : state.duration * 1000 * durationJitter,
      started = performance.now();
    let previousSector = Math.floor((start + Math.PI / 2) / step),
      lastTick = 0;
    function frame(now) {
      const p = Math.min(1, (now - started) / duration),
        // Near-quadratic braking carries visible motion through the last seconds,
        // with continuous deceleration and zero final speed (no extra waiting).
        eased = 1 - Math.pow(1 - p, brakingPower);
      rotation = start + (target - start) * eased;
      if (!reduced.matches) canvas.style.transform = `rotate(${rotation}rad)`;
      const sector = Math.floor((rotation + Math.PI / 2) / step);
      if (
        sector !== previousSector &&
        now - lastTick > 32 &&
        !reduced.matches
      ) {
        tick();
        lastTick = now;
      }
      previousSector = sector;
      if (p < 1) requestAnimationFrame(frame);
      else finish(index, finalAngle);
    }
    requestAnimationFrame(frame);
  }
  function finish(index, angle) {
    rotation = angle;
    canvas.style.transform = `rotate(${rotation}rad)`;
    spinning = false;
    const name = wheel()[index];
    winnerIndex = state.entries.indexOf(name);
    state.history.unshift({ name, time: Date.now() });
    state.history = state.history.slice(0, 200);
    $("winnerName").textContent = name;
    $("lastResult").textContent = `Últim resultat: ${name}`;
    if (state.noRepeat) {
      state.entries = state.entries.filter((entry) => entry !== name);
      winnerIndex = null;
      syncInput();
    }
    $("winnerDescription").textContent = state.noRepeat
      ? wheel().length
        ? `Aquesta opció ja s’ha retirat. En queden ${wheel().length}.`
        : "Han sortit totes les opcions. Recupera els participants per tornar a començar."
      : "La sort ha parlat. Quina serà la propera sorpresa?";
    $("winnerDescription").classList.toggle(
      "sr-only",
      wheel().length > 0,
    );
    $("removeButton").hidden = state.noRepeat;
    $("againButton").disabled = !wheel().length;
    renderHistory();
    refresh();
    save();
    celebrate();
    dialog.showModal();
    $("againButton").disabled
      ? $("closeWinner").focus()
      : $("againButton").focus();
    tone(523.25, 0.35, 0, "sine", 0.17);
    tone(659.25, 0.4, 0.11, "sine", 0.17);
    tone(783.99, 0.5, 0.22, "sine", 0.17);
    tone(1046.5, 0.65, 0.36, "sine", 0.12);
  }
  function celebrate() {
    $("confetti").replaceChildren();
    if (!state.confetti || reduced.matches) return;
    for (let i = 0; i < 22; i++) {
      const bit = document.createElement("i");
      bit.style.left = `${randomInt(100)}%`;
      bit.style.background =
        PALETTES[state.palette][i % PALETTES[state.palette].length];
      bit.style.animationDelay = `${randomInt(700)}ms`;
      bit.style.rotate = `${randomInt(180)}deg`;
      $("confetti").append(bit);
    }
  }
  function closeWinner() {
    if (dialog.open) dialog.close();
  }
  function download(text, name, type) {
    const url = URL.createObjectURL(new Blob([text], { type })),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function applySettings() {
    $("titleInput").value = state.title;
    $("wheelTitle").textContent =
      state.title.trim() || "Que la sort decideixi!";
    $("durationInput").value = state.duration;
    $("paletteInput").value = state.palette;
    $("volumeInput").value = state.volume;
    $("volumeValue").textContent = `${state.volume}%`;
    $("noRepeatToggle").checked = state.noRepeat;
    $("confettiToggle").checked = state.confetti;
    document.documentElement.dataset.theme = state.dark ? "dark" : "light";
    $("themeButton").setAttribute("aria-pressed", String(state.dark));
    $("themeButton").setAttribute(
      "aria-label",
      state.dark ? "Activa el tema clar" : "Activa el tema fosc",
    );
    $("soundButton").setAttribute("aria-pressed", String(state.muted));
    $("soundButton").setAttribute(
      "aria-label",
      state.muted ? "Activa el so" : "Silencia el so",
    );
    $("soundButton").textContent = state.muted ? "♪̸" : "♫";
    if (master)
      master.gain.setValueAtTime(
        state.muted ? 0 : state.volume / 100,
        audioContext.currentTime,
      );
  }
  function renderRoster() {
    const showRoster = state.noRepeat && !editingList;
    $("entryRoster").hidden = !showRoster;
    $("entriesInput").hidden = showRoster;
    $("editListButton").hidden = !state.noRepeat;
    $("editListButton").textContent = editingList ? "Fet" : "Edita";
    $("editListNote").hidden = !state.noRepeat || !editingList;
    $("entryFeedback").hidden = showRoster;
    $("activityHelp").hidden = !state.activity;
    $("activityInstructions").textContent = state.activity?.instructions || "";
    if (!showRoster) return;
    const counts = new Map();
    state.entries.forEach((name) =>
      counts.set(name, (counts.get(name) || 0) + 1),
    );
    const retired = state.base.filter((name) => {
      const left = counts.get(name) || 0;
      if (left) {
        counts.set(name, left - 1);
        return false;
      }
      return true;
    });
    const roster = $("entryRoster");
    roster.replaceChildren();
    function group(names, title, isRetired) {
      const heading = document.createElement("p");
      heading.className = "roster-heading";
      heading.textContent = `${title} · ${names.length}`;
      const list = document.createElement("ol");
      list.className = isRetired ? "roster-retired" : "roster-pending";
      names.forEach((name) => {
        const item = document.createElement("li");
        const text = document.createElement(isRetired ? "s" : "span");
        text.textContent = name;
        item.append(text);
        list.append(item);
      });
      roster.append(heading, list);
    }
    group(state.entries, "Pendents", false);
    if (retired.length) group(retired, "Ja han sortit", true);
    if (!state.entries.length) {
      const message = document.createElement("p");
      message.className = "field-note";
      message.textContent = "Recupera els participants per tornar a començar.";
      roster.prepend(message);
    }
  }
  $("editListButton").addEventListener("click", () => {
    if (spinning) return;
    editingList = !editingList;
    if (editingList) $("entriesInput").value = state.base.join("\n");
    else syncInput();
    renderRoster();
    if (editingList) $("entriesInput").focus();
  });

  function renderClasses() {
    $("classCount").textContent = state.classes.length
      ? `(${state.classes.length})`
      : "";
    $("classList").replaceChildren(
      ...state.classes.map((group) => {
        const row = document.createElement("div");
        row.className = "saved-class";
        const load = document.createElement("button");
        load.className = "load-class";
        load.textContent = group.name;
        load.title = `${group.entries.length} ${group.entries.length === 1 ? "participant" : "participants"} · Comença una nova ronda`;
        load.addEventListener("click", () => {
          if (spinning) return;
          checkpoint();
          state.entries = [...group.entries];
          state.base = [...group.entries];
          state.title = group.name;
          state.activity = null;
          editingList = false;
          $("className").value = group.name;
          changed();
          toast(
            `${group.name}: ${group.entries.length} ${group.entries.length === 1 ? "participant recuperat" : "participants recuperats"}. Pots desfer el canvi.`,
          );
        });
        const remove = document.createElement("button");
        remove.className = "remove-class";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Elimina la classe ${group.name}`);
        remove.addEventListener("click", () => {
          if (spinning) return;
          state.classes = state.classes.filter((c) => c.id !== group.id);
          save();
          renderClasses();
          $("className").focus();
        });
        row.append(load, remove);
        return row;
      }),
    );
  }
  $("saveClassForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (spinning || invalidDraft || !state.base.length) return;
    const name = $("className").value.trim();
    if (!name) return;
    const existing = state.classes.find(
      (c) => c.name.toLocaleLowerCase("ca") === name.toLocaleLowerCase("ca"),
    );
    if (!existing && state.classes.length >= 50) {
      toast(
        "Pots desar fins a 50 classes. Elimina’n alguna abans d’afegir-ne una altra.",
      );
      return;
    }
    const group = {
      id: existing?.id || crypto.randomUUID(),
      name,
      entries: [...state.base],
    };
    if (existing) state.classes[state.classes.indexOf(existing)] = group;
    else state.classes.push(group);
    const persisted = save();
    renderClasses();
    if (!persisted) {
      toast(
        "No s’ha pogut desar la classe al navegador. Desa una còpia de la llista.",
      );
      return;
    }
    toast(
      existing
        ? "Classe actualitzada amb la llista completa."
        : "Classe desada en aquest navegador.",
    );
  });
  renderClasses();
  $("savedClasses").open = state.classes.length > 0;

  const libraryThemes = (window.RULETA_LIBRARY?.themes || []).filter(
    (theme) =>
      theme &&
      typeof theme.title === "string" &&
      typeof theme.instructions === "string" &&
      typeof theme.category === "string" &&
      Array.isArray(theme.levels) &&
      validEntries(theme.entries),
  );
  const libraryDialog = $("libraryDialog");
  let selectedTheme = null;
  const searchText = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("ca");
  for (const category of [
    ...new Set(libraryThemes.map((t) => t.category)),
  ].sort((a, b) => a.localeCompare(b, "ca"))) {
    const option = document.createElement("option");
    option.value = option.textContent = category;
    $("themeCategory").append(option);
  }
  function selectTheme(theme, focus = false) {
    selectedTheme = theme;
    $("themeDetail").hidden = !theme;
    for (const button of $("themeCards").querySelectorAll(".theme-card"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.theme === theme?.id),
      );
    $("loadThemeButton").disabled = $("downloadThemeButton").disabled = !theme;
    if (!theme) return;
    $("themeMeta").textContent =
      `${theme.category} · ${theme.entries.length} opcions`;
    $("themeTitle").textContent = theme.title;
    $("themeDescription").textContent = theme.description;
    $("themeInstructions").textContent = theme.instructions;
    $("themePreview").replaceChildren(
      ...theme.entries.map((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        return li;
      }),
    );
    if (focus && window.innerWidth < 720) $("themeTitle").focus();
  }
  function filterThemes() {
    const query = searchText($("themeSearch").value.trim());
    const category = $("themeCategory").value,
      level = $("themeLevel").value;
    const matches = libraryThemes.filter(
      (t) =>
        (!category ||
          (category === "__favorites"
            ? state.favorites.includes(t.id)
            : t.category === category)) &&
        (!level || t.levels.includes(level)) &&
        (!query ||
          searchText(
            [t.title, t.description, t.category, ...t.entries].join(" "),
          ).includes(query)),
    );
    $("themeCards").replaceChildren(
      ...matches.map((theme) => {
        const shell = document.createElement("div");
        shell.className = "theme-card-shell";
        shell.dataset.color = String(
          [...new Set(libraryThemes.map((t) => t.category))].indexOf(
            theme.category,
          ),
        );
        const button = document.createElement("button");
        button.className = "theme-card";
        button.dataset.theme = theme.id;
        const label = document.createElement("small"),
          title = document.createElement("strong"),
          description = document.createElement("span");
        label.textContent = `${theme.category} · ${theme.entries.length}`;
        title.textContent = theme.title;
        description.textContent = theme.description;
        button.append(label, title, description);
        button.addEventListener("click", () => selectTheme(theme, true));
        const star = document.createElement("button");
        const favorite = state.favorites.includes(theme.id);
        star.className = "theme-star";
        star.dataset.favorite = theme.id;
        star.textContent = favorite ? "★" : "☆";
        star.setAttribute("aria-pressed", String(favorite));
        star.setAttribute(
          "aria-label",
          `${favorite ? "Treu de preferides" : "Marca com a preferida"}: ${theme.title}`,
        );
        star.addEventListener("click", () => {
          state.favorites = favorite
            ? state.favorites.filter((id) => id !== theme.id)
            : [...state.favorites, theme.id];
          save();
          filterThemes();
          const next = Array.from(
            $("themeCards").querySelectorAll(".theme-star"),
          ).find((b) => b.dataset.favorite === theme.id);
          (next || $("themeCategory")).focus();
        });
        shell.append(button, star);
        return shell;
      }),
    );
    $("themeCount").textContent =
      `${matches.length} ${matches.length === 1 ? "tema disponible" : "temes disponibles"}`;
    $("themeEmpty").hidden = matches.length > 0;
    selectTheme(
      matches.find((t) => t.id === selectedTheme?.id) || matches[0] || null,
    );
  }
  $("libraryButton").addEventListener("click", () => {
    if (spinning) return;
    if (invalidDraft) {
      toast("Corregeix primer la llista o buida-la abans de carregar un tema.");
      return;
    }
    if (!libraryThemes.length) {
      toast("No s’ha pogut carregar la biblioteca. Comprova la carpeta data.");
      return;
    }
    filterThemes();
    libraryDialog.showModal();
    $("themeSearch").focus();
  });
  $("closeLibrary").addEventListener("click", () => libraryDialog.close());
  libraryDialog.addEventListener("close", () => $("libraryButton").focus());
  for (const id of ["themeSearch", "themeCategory", "themeLevel"])
    $(id).addEventListener("input", filterThemes);
  $("loadThemeButton").addEventListener("click", () => {
    if (!selectedTheme || spinning) return;
    let entries = [...selectedTheme.entries];
    const amount = $("themeAmount").value;
    if (amount !== "all") {
      for (let i = entries.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [entries[i], entries[j]] = [entries[j], entries[i]];
      }
      entries = entries.slice(0, Number(amount));
    }
    const append = $("themeMode").value === "append";
    if (append && state.base.length + entries.length > 200) {
      $("themeLoadNote").textContent =
        "La llista completa superaria les 200 opcions. Tria menys opcions o substitueix-la.";
      return;
    }
    checkpoint();
    if (append) {
      state.entries.push(...entries);
      state.base.push(...entries);
      state.activity = null;
    } else {
      state.entries = entries;
      state.base = [...entries];
      state.title = selectedTheme.title;
      state.activity = {
        title: selectedTheme.title,
        instructions: selectedTheme.instructions,
      };
    }
    editingList = false;
    changed();
    selectTab("entries");
    libraryDialog.close();
    toast(`${entries.length} ${entries.length === 1 ? "opció carregada" : "opcions carregades"}. Pots desfer el canvi.`);
  });
  $("themeMode").addEventListener(
    "change",
    () => ($("themeLoadNote").textContent = "Podràs desfer el canvi."),
  );
  $("downloadThemeButton").addEventListener("click", () => {
    if (!selectedTheme) return;
    download(
      JSON.stringify(
        {
          format: "ruleta-felip",
          version: 1,
          title: selectedTheme.title,
          entries: selectedTheme.entries,
          base: selectedTheme.entries,
          activity: {
            title: selectedTheme.title,
            instructions: selectedTheme.instructions,
          },
        },
        null,
        2,
      ),
      `ruleta-${selectedTheme.id}.json`,
      "application/json",
    );
  });

  function selectTab(name, focus = false) {
    for (const key of ["entries", "history", "settings"]) {
      const selected = key === name;
      $(`tab-${key}`).classList.toggle("active", selected);
      $(`tab-${key}`).setAttribute("aria-selected", String(selected));
      $(`tab-${key}`).tabIndex = selected ? 0 : -1;
      $(`panel-${key}`).hidden = !selected;
    }
    if (focus) $(`tab-${name}`).focus();
  }
  for (const name of ["entries", "history", "settings"])
    $(`tab-${name}`).addEventListener("click", () => selectTab(name));
  document.querySelector(".tabs").addEventListener("keydown", (e) => {
    const tabs = [...document.querySelectorAll("[role=tab]")],
      i = tabs.indexOf(document.activeElement);
    let next;
    if (e.key === "ArrowRight") next = (i + 1) % 3;
    else if (e.key === "ArrowLeft") next = (i + 2) % 3;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 2;
    else return;
    e.preventDefault();
    selectTab(tabs[next].id.replace("tab-", ""), true);
  });
  $("entriesInput").addEventListener("input", () => {
    feedback();
    if (invalidDraft) {
      refresh();
      return;
    }
    checkpoint();
    state.entries = parse($("entriesInput").value);
    state.base = [...state.entries];
    state.activity = null;
    winnerIndex = null;
    rotation = 0;
    drawWheel();
    refresh();
    save();
  });
  $("spinButton").addEventListener("click", spin);
  $("hubButton").addEventListener("click", spin);
  $("shuffleButton").addEventListener("click", () => {
    if (invalidDraft) {
      toast("Corregeix primer la llista.");
      return;
    }
    checkpoint();
    for (let i = state.entries.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [state.entries[i], state.entries[j]] = [
        state.entries[j],
        state.entries[i],
      ];
    }
    changed();
  });
  $("dedupeButton").addEventListener("click", () => {
    if (invalidDraft) {
      toast("Corregeix primer la llista.");
      return;
    }
    checkpoint();
    state.entries = [...new Set(state.entries)];
    changed({ base: true });
  });
  $("clearButton").addEventListener("click", () => {
    checkpoint();
    state.entries = [];
    changed();
    toast("Llista buidada. Pots desfer-ho.");
  });
  $("restoreButton").addEventListener("click", () => {
    checkpoint();
    state.entries = [...state.base];
    changed();
    toast("Participants recuperats.");
  });
  $("undoButton").addEventListener("click", () => {
    if (!undoState) return;
    Object.assign(state, undoState);
    undoState = null;
    changed();
    toast("Canvi desfet.");
  });
  $("closeWinner").addEventListener("click", closeWinner);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        closeWinner();
    }
  });
  dialog.addEventListener("close", () => {
    drawWheel();
    $("confetti").replaceChildren();
    $("spinButton").disabled
      ? $("restoreButton").focus()
      : $("spinButton").focus();
  });
  $("againButton").addEventListener("click", () => {
    closeWinner();
    drawWheel();
    spin();
  });
  $("removeButton").addEventListener("click", () => {
    if (winnerIndex === null) return;
    checkpoint();
    state.entries.splice(winnerIndex, 1);
    winnerIndex = null;
    closeWinner();
    changed();
    toast("Opció eliminada. Pots desfer-ho.");
  });
  $("clearHistoryButton").addEventListener("click", () => {
    checkpoint();
    state.history = [];
    renderHistory();
    refresh();
    save();
    toast("Historial esborrat. Pots desfer-ho des d’Opcions.");
  });
  $("exportButton").addEventListener("click", () =>
    download(
      JSON.stringify(
        {
          format: "ruleta-felip",
          version: 1,
          title: state.title,
          entries: state.entries,
          base: state.base,
          activity: state.activity,
        },
        null,
        2,
      ),
      "ruleta.json",
      "application/json",
    ),
  );
  $("exportHistoryButton").addEventListener("click", () => {
    const safe = (x) =>
      '"' +
      String(/^[\s]*[=+@-]/.test(x) ? "'" + x : x).replaceAll('"', '""') +
      '"';
    const rows = [
      "Resultat;Data",
      ...state.history.map(
        (h) => `${safe(h.name)};${safe(new Date(h.time).toISOString())}`,
      ),
    ];
    download(
      "\uFEFF" + rows.join("\r\n"),
      "resultats-ruleta.csv",
      "text/csv;charset=utf-8",
    );
  });
  $("importButton").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", async () => {
    const file = $("fileInput").files[0];
    $("fileInput").value = "";
    if (!file) return;
    if (file.size > 100000) {
      toast("El fitxer és massa gran. Màxim 100 kB.");
      return;
    }
    try {
      const raw = await file.text();
      if (spinning) {
        toast("Espera que acabi el gir per importar.");
        return;
      }
      let entries,
        activity = null,
        base,
        title = state.title;
      if (file.name.toLowerCase().endsWith(".json")) {
        const data = JSON.parse(raw.replace(/^\uFEFF/, ""));
        entries = data.entries;
        if (
          data.activity &&
          typeof data.activity.title === "string" &&
          typeof data.activity.instructions === "string"
        )
          activity = {
            title: data.activity.title.slice(0, 70),
            instructions: data.activity.instructions.slice(0, 2000),
          };
        base = data.base ?? entries;
        if (typeof data.title === "string") title = data.title.slice(0, 70);
      } else {
        entries = parse(raw);
        base = entries;
      }
      if (!validEntries(entries) || !validEntries(base)) throw Error();
      checkpoint();
      state.entries = entries;
      state.activity = activity;
      state.base = base;
      state.title = title;
      applySettings();
      changed();
      toast("Llista importada.");
    } catch {
      toast(
        "Fitxer no vàlid. Importa un .txt amb una opció per línia o una còpia .json de la ruleta.",
      );
    }
  });
  for (const [id, key, type] of [
    ["titleInput", "title", "text"],
    ["durationInput", "duration", "number"],
    ["paletteInput", "palette", "text"],
    ["volumeInput", "volume", "number"],
    ["noRepeatToggle", "noRepeat", "bool"],
    ["confettiToggle", "confetti", "bool"],
  ]) {
    $(id).addEventListener("input", () => {
      state[key] =
        type === "bool"
          ? $(id).checked
          : type === "number"
            ? Number($(id).value)
            : $(id).value;
      if (key === "noRepeat") editingList = false;
      applySettings();
      refresh();
      if (key === "palette") drawWheel();
      save();
    });
  }
  $("soundButton").addEventListener("click", () => {
    state.muted = !state.muted;
    audioReady();
    applySettings();
    save();
    if (!state.muted) tone(660, 0.12);
  });
  $("themeButton").addEventListener("click", () => {
    state.dark = !state.dark;
    applySettings();
    if (!spinning) drawWheel();
    save();
  });
  async function setPresentation(on) {
    document.body.classList.toggle("present", on);
    $("presentButton").setAttribute("aria-pressed", String(on));
    $("presentButton").innerHTML = on
      ? "⛶ <span>Surt del mode aula</span>"
      : "⛶ <span>Mode aula</span>";
    try {
      if (
        on &&
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      )
        await document.documentElement.requestFullscreen();
      else if (!on && document.fullscreenElement)
        await document.exitFullscreen();
    } catch {
      /* Focus mode works even when fullscreen is unavailable. */
    }
  }
  $("presentButton").addEventListener("click", () =>
    setPresentation(!document.body.classList.contains("present")),
  );
  document.addEventListener("fullscreenchange", () => {
    if (
      !document.fullscreenElement &&
      document.body.classList.contains("present")
    )
      setPresentation(false);
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      !dialog.open &&
      !$("libraryDialog").open &&
      document.body.classList.contains("present")
    )
      setPresentation(false);
    if (
      e.code !== "Space" ||
      e.repeat ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      dialog.open ||
      $("libraryDialog").open ||
      /INPUT|TEXTAREA|SELECT|BUTTON|A/.test(e.target.tagName) ||
      e.target.isContentEditable
    )
      return;
    e.preventDefault();
    spin();
  });
  let fitFrame;
  function fitLayout() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      const stage = document.querySelector(".stage");
      const heading = document.querySelector(".stage-heading");
      const footer = document.querySelector("footer");
      const top = stage.getBoundingClientRect().top + window.scrollY;
      const available =
        window.innerHeight -
        footer.offsetHeight -
        top -
        heading.offsetHeight -
        $("spinButton").offsetHeight -
        // Marge inferior del cos (24 px) i separacions: així la pàgina no fa desplaçament.
        62;
      const cap = window.innerWidth < 900 ? 520 : 720;
      const size = Math.min(
        stage.clientWidth - 20,
        cap,
        Math.max(180, available),
      );
      stage.style.setProperty("--wheel-size", `${Math.floor(size)}px`);
      document.documentElement.style.setProperty(
        "--footer-height",
        `${footer.offsetHeight}px`,
      );
    });
  }
  const layoutObserver = new ResizeObserver(fitLayout);
  for (const selector of [".stage-heading", ".topbar", "footer", ".layout"])
    layoutObserver.observe(document.querySelector(selector));
  window.addEventListener("resize", fitLayout);
  window.visualViewport?.addEventListener("resize", fitLayout);
  fitLayout();
  new ResizeObserver(() => {
    if (!dialog.open || !state.noRepeat) drawWheel();
  }).observe(canvas);
  window.addEventListener("resize", () => {
    if (!dialog.open) drawWheel();
  });
  if (window.Atzar)
    renderAbsents = window.Atzar.setupAbsents({
      host: $("absentList"),
      getNames: () => state.base,
      onChange() {
        if (spinning) return;
        rotation = 0;
        drawWheel();
        refresh();
      },
    });
  applySettings();
  syncInput();
  drawWheel();
  renderHistory();
  refresh();
  if (state.history.length)
    $("lastResult").textContent = `Últim resultat: ${state.history[0].name}`;
  if (loadFailed)
    toast(
      "No s’han pogut recuperar les dades desades. Pots importar una còpia.",
    );
})();
