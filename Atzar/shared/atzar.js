/* Atzar a l'aula — utilitats comunes, sense dependències ni peticions de xarxa. */
window.Atzar = (() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const PREFS_KEY = "felip.atzar.prefs",
    CLASSES_KEY = "felip.atzar.classes",
    RULETA_KEY = "felip.ruleta.v2";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  /* App instal·lable i sense connexió (no funciona en obrir els fitxers directament). */
  const root = new URL("../", document.currentScript?.src || location.href);
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol))
    addEventListener("load", () =>
      navigator.serviceWorker.register(new URL("sw.js", root)).catch(() => {}),
    );

  /* Atzar: crypto.getRandomValues amb mostreig per rebuig (sense biaix del mòdul). */
  function randomInt(n) {
    if (!Number.isInteger(n) || n < 1) throw RangeError("n ha de ser ≥ 1");
    const max = 0x100000000 - (0x100000000 % n),
      a = new Uint32Array(1);
    do crypto.getRandomValues(a);
    while (a[0] >= max);
    return a[0] % n;
  }
  const randomBetween = (min, max) => min + randomInt(max - min + 1);
  const pick = (list) => list[randomInt(list.length)];
  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Desament local */
  function load(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  const prefs = Object.assign(
    { dark: false, muted: false, volume: 45 },
    load(PREFS_KEY, {}),
  );
  const savePrefs = () => save(PREFS_KEY, prefs);

  /* So sintetitzat amb Web Audio */
  let audioContext, master;
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
        prefs.muted ? 0 : prefs.volume / 100,
        audioContext.currentTime,
      );
      if (audioContext.state === "suspended")
        audioContext.resume().catch(() => {});
    } catch {
      /* La manca d'àudio no bloqueja mai un sorteig. */
    }
  }
  function tone(freq, duration, delay = 0, type = "sine", level = 0.18) {
    if (!audioContext || !master || prefs.muted || document.hidden) return;
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
  function noise(duration = 0.05, delay = 0, level = 0.12, freq = 2400) {
    if (!audioContext || !master || prefs.muted || document.hidden) return;
    const t = audioContext.currentTime + delay,
      length = Math.max(1, Math.floor(audioContext.sampleRate * duration)),
      buffer = audioContext.createBuffer(1, length, audioContext.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = audioContext.createBufferSource(),
      filter = audioContext.createBiquadFilter(),
      gain = audioContext.createGain();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    gain.gain.value = level;
    src.buffer = buffer;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  const sounds = {
    tick: () => tone(950, 0.035, 0, "triangle", 0.24),
    click: () => tone(660, 0.08, 0, "sine", 0.14),
    win() {
      tone(523.25, 0.5, 0, "sine", 0.16);
      tone(659.25, 0.5, 0.08, "sine", 0.14);
      tone(783.99, 0.7, 0.16, "sine", 0.14);
    },
    alarm() {
      for (let i = 0; i < 3; i++) {
        tone(880, 0.16, i * 0.42, "square", 0.08);
        tone(880, 0.16, i * 0.42 + 0.2, "square", 0.08);
      }
    },
    boom() {
      noise(0.6, 0, 0.5, 300);
      tone(70, 0.6, 0, "sawtooth", 0.18);
    },
  };

  /* Missatges i celebració. action = {label, run}: el missatge ofereix un botó i dura més. */
  let toastTimer;
  function toast(message, action) {
    const el = $("toast");
    if (!el) return;
    el.replaceChildren(message);
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toast-action";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        el.hidden = true;
        action.run();
      });
      el.append(button);
    }
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), action ? 8000 : 2600);
  }
  /* Les accions que esborren dades no demanen confirmació: es poden desfer uns segons. */
  function undoable(message, restore) {
    toast(message, {
      label: "Desfés",
      run() {
        restore();
        toast("Fet: s’ha recuperat tal com estava.");
      },
    });
  }
  const CONFETTI = ["#d47761", "#e2ad55", "#759479", "#5f91a6", "#817ca6"];
  function confetti(host) {
    if (!host || reduced.matches) return;
    host.replaceChildren();
    for (let i = 0; i < 42; i++) {
      const piece = document.createElement("i");
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = CONFETTI[i % CONFETTI.length];
      piece.style.animationDelay = `${Math.random() * 0.45}s`;
      host.append(piece);
    }
  }

  /* Format i fitxers */
  const timeFormat = new Intl.DateTimeFormat("ca", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formatTime = (ms) => timeFormat.format(new Date(ms));
  function download(name, text, type = "text/plain") {
    const url = URL.createObjectURL(
      new Blob([text], { type: `${type};charset=utf-8` }),
    );
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: name,
    });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  // «de» davant d'un nombre: s'apostrofa davant d'1, 11 i 11.000-11.999 («d’1», «d’11»).
  const de = (n) => (/^(1|11|11\d{3})$/.test(String(n)) ? "d’" : "de ");
  function downloadCsv(name, rows) {
    download(
      name,
      "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n"),
      "text/csv",
    );
  }
  function parseLines(raw, max = 200) {
    return raw
      .split(/\r?\n/)
      .map((x) => x.trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, max);
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copiat al porta-retalls.");
    } catch {
      toast("No s’ha pogut copiar. Selecciona el text manualment.");
    }
  }

  /* Historial genèric: items = [{label, detail?, time}] */
  function renderHistory(list, empty, items, countEl) {
    list.replaceChildren(
      ...items.map((item, i) => {
        const li = document.createElement("li"),
          n = document.createElement("span"),
          label = document.createElement("strong"),
          time = document.createElement("time");
        n.className = "number";
        n.textContent = items.length - i;
        label.textContent = item.label;
        time.textContent = formatTime(item.time);
        time.dateTime = new Date(item.time).toISOString();
        li.append(n, label, time);
        return li;
      }),
    );
    empty.hidden = items.length > 0;
    if (countEl) countEl.textContent = items.length;
  }

  /* Classes compartides: les de la Ruleta (només lectura) i les desades aquí. */
  const validList = (a) =>
    Array.isArray(a) &&
    a.length > 0 &&
    a.length <= 200 &&
    a.every((x) => typeof x === "string" && x.trim() && x.length <= 80);
  function ownClasses() {
    const list = load(CLASSES_KEY, []);
    return Array.isArray(list)
      ? list.filter(
          (c) =>
            c &&
            typeof c.id === "string" &&
            typeof c.name === "string" &&
            validList(c.entries),
        )
      : [];
  }
  function getClasses() {
    const own = ownClasses().map((c) => ({ ...c, source: "atzar" }));
    const ruleta = load(RULETA_KEY, {});
    const fromRuleta = Array.isArray(ruleta?.classes)
      ? ruleta.classes
          .filter(
            (c) =>
              c &&
              typeof c.name === "string" &&
              validList(c.entries) &&
              !own.some(
                (o) => o.name.toLowerCase() === c.name.toLowerCase(),
              ),
          )
          .map((c) => ({
            id: `ruleta-${c.id}`,
            name: c.name,
            entries: c.entries,
            source: "ruleta",
          }))
      : [];
    return [...own, ...fromRuleta].sort((a, b) =>
      a.name.localeCompare(b.name, "ca", { numeric: true }),
    );
  }
  function saveClass(name, entries) {
    const list = ownClasses(),
      clean = name.trim().slice(0, 40);
    if (!clean || !validList(entries)) return false;
    const existing = list.find(
      (c) => c.name.toLowerCase() === clean.toLowerCase(),
    );
    if (!existing && list.length >= 50) {
      toast("Pots desar fins a 50 classes.");
      return false;
    }
    const group = {
      id: existing?.id || `c${Date.now().toString(36)}`,
      name: clean,
      entries: [...entries],
    };
    if (existing) list[list.indexOf(existing)] = group;
    else list.push(group);
    return save(CLASSES_KEY, list);
  }
  function removeClass(id) {
    save(
      CLASSES_KEY,
      ownClasses().filter((c) => c.id !== id),
    );
  }
  /* Panell «Les meves classes»: details#savedLists amb #classList i form#saveClassForm. */
  function setupClasses({ getEntries, onLoad }) {
    const host = $("classList"),
      form = $("saveClassForm"),
      count = $("classCount");
    if (!host || !form) return () => {};
    function render() {
      const classes = getClasses();
      count.textContent = classes.length ? `(${classes.length})` : "";
      host.replaceChildren(
        ...classes.map((group) => {
          const row = document.createElement("div"),
            load = document.createElement("button"),
            small = document.createElement("small");
          row.className = "saved-class";
          load.className = "load-class";
          load.type = "button";
          load.textContent = group.name;
          small.textContent = `${group.entries.length}${group.source === "ruleta" ? " · Ruleta" : ""}`;
          load.append(small);
          load.addEventListener("click", () => {
            onLoad(group);
            toast(`Classe «${group.name}» carregada.`);
          });
          row.append(load);
          if (group.source === "atzar") {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "remove-class";
            remove.setAttribute("aria-label", `Elimina ${group.name}`);
            remove.textContent = "×";
            remove.addEventListener("click", () => {
              const before = ownClasses();
              removeClass(group.id);
              render();
              undoable(`Classe «${group.name}» eliminada.`, () => {
                save(CLASSES_KEY, before);
                render();
              });
            });
            row.append(remove);
          }
          return row;
        }),
      );
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input"),
        entries = getEntries();
      if (!entries.length) return toast("La llista és buida.");
      if (saveClass(input.value, entries)) {
        toast(`Classe «${input.value.trim()}» desada.`);
        input.value = "";
        render();
      }
    });
    render();
    return render;
  }

  /* Capçalera, tema, so, mode aula, pestanyes i dreceres */
  function applyPrefs() {
    document.documentElement.dataset.theme = prefs.dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", prefs.dark ? "#172923" : "#f5f3ee");
    const sound = $("soundButton"),
      theme = $("themeButton"),
      volume = $("volumeInput");
    if (sound) {
      sound.setAttribute("aria-pressed", String(prefs.muted));
      sound.setAttribute(
        "aria-label",
        prefs.muted ? "Activa el so" : "Silencia el so",
      );
      sound.textContent = prefs.muted ? "♪̸" : "♫";
      sound.style.opacity = prefs.muted ? 0.55 : 1;
    }
    if (theme) {
      theme.setAttribute("aria-pressed", String(prefs.dark));
      theme.setAttribute(
        "aria-label",
        prefs.dark ? "Activa el tema clar" : "Activa el tema fosc",
      );
    }
    if (volume) {
      volume.value = prefs.volume;
      const out = $("volumeValue");
      if (out) out.textContent = `${prefs.volume}%`;
    }
    if (master && audioContext)
      master.gain.setValueAtTime(
        prefs.muted ? 0 : prefs.volume / 100,
        audioContext.currentTime,
      );
  }
  async function setPresentation(on) {
    document.body.classList.toggle("present", on);
    const button = $("presentButton");
    if (button) {
      button.setAttribute("aria-pressed", String(on));
      button.innerHTML = on
        ? "⛶ <span>Surt del mode aula</span>"
        : "⛶ <span>Mode aula</span>";
    }
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
      /* El mode aula funciona encara que no hi hagi pantalla completa. */
    }
    fitLayout();
  }
  function setupTabs() {
    const tabs = [...document.querySelectorAll(".tabs .tab")];
    function select(tab, focus) {
      for (const t of tabs) {
        const on = t === tab;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        $(t.getAttribute("aria-controls")).hidden = !on;
      }
      if (focus) tab.focus();
      tab.dispatchEvent(new CustomEvent("tabshown", { bubbles: true }));
    }
    for (const tab of tabs)
      tab.addEventListener("click", () => select(tab, false));
    document.querySelector(".tabs")?.addEventListener("keydown", (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const next = {
        ArrowRight: (i + 1) % tabs.length,
        ArrowLeft: (i - 1 + tabs.length) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
      }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(tabs[next], true);
    });
    return select;
  }
  const isTyping = (el) =>
    /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(el.tagName) ||
    el.isContentEditable;

  /* En mode aula, els objectes poden créixer fins a omplir la pantalla. */
  const cap = (n) => n * (document.body.classList.contains("present") ? 1.6 : 1);

  /* Ajusta l'alçada de l'àrea de joc a la finestra útil, com la roda de la Ruleta. */
  let fitFrame,
    fitOptions = { min: 220, max: 620, reserve: 0 };
  function fitLayout() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      const area = document.querySelector(".play-area"),
        footer = document.querySelector(".felip-app-footer");
      if (footer)
        document.documentElement.style.setProperty(
          "--footer-height",
          `${footer.offsetHeight}px`,
        );
      if (!area) return;
      let after = 0;
      for (let el = area.nextElementSibling; el; el = el.nextElementSibling)
        if (!el.classList.contains("sr-only")) after += el.offsetHeight + 12;
      const top = area.getBoundingClientRect().top + window.scrollY,
        available =
          window.innerHeight -
          (footer?.offsetHeight || 0) -
          top -
          after -
          36 -
          fitOptions.reserve;
      const narrow = window.innerWidth < 900,
        max = narrow ? Math.min(fitOptions.max, 460) : fitOptions.max * cap(1);
      const size = Math.max(fitOptions.min, Math.min(max, available));
      document.documentElement.style.setProperty(
        "--play-height",
        `${Math.floor(size)}px`,
      );
      document.dispatchEvent(new CustomEvent("atzar:fit", { detail: size }));
    });
  }

  /**
   * Inicialitza la carcassa comuna.
   * options.onAction: acció principal (barra d'espai).
   * options.isBusy: retorna true si cal ignorar l'espai.
   * options.fit: {min, max, reserve} per a l'àrea de joc.
   */
  function init(options = {}) {
    Object.assign(fitOptions, options.fit || {});
    applyPrefs();
    $("soundButton")?.addEventListener("click", () => {
      prefs.muted = !prefs.muted;
      savePrefs();
      applyPrefs();
      audioReady();
      if (!prefs.muted) sounds.click();
    });
    $("themeButton")?.addEventListener("click", () => {
      prefs.dark = !prefs.dark;
      savePrefs();
      applyPrefs();
      document.dispatchEvent(new CustomEvent("atzar:theme"));
    });
    $("volumeInput")?.addEventListener("input", (e) => {
      prefs.volume = Number(e.target.value);
      savePrefs();
      applyPrefs();
    });
    $("volumeInput")?.addEventListener("change", () => {
      audioReady();
      sounds.click();
    });
    $("presentButton")?.addEventListener("click", () =>
      setPresentation(!document.body.classList.contains("present")),
    );
    document.addEventListener("fullscreenchange", () => {
      if (
        !document.fullscreenElement &&
        document.body.classList.contains("present")
      )
        setPresentation(false);
    });
    for (const button of document.querySelectorAll("[data-close]"))
      button.addEventListener("click", () => button.closest("dialog").close());
    for (const dialog of document.querySelectorAll("dialog"))
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) dialog.close();
      });
    document.addEventListener("keydown", (e) => {
      const dialogOpen = document.querySelector("dialog[open]");
      if (
        e.key === "Escape" &&
        !dialogOpen &&
        document.body.classList.contains("present")
      )
        setPresentation(false);
      if (
        e.code !== "Space" ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        dialogOpen ||
        isTyping(e.target) ||
        !options.onAction ||
        options.isBusy?.()
      )
        return;
      e.preventDefault();
      audioReady();
      options.onAction();
    });
    const selectTab = setupTabs();
    const observer = new ResizeObserver(fitLayout);
    for (const selector of [".stage-heading", ".topbar", ".felip-app-footer", ".layout"]) {
      const el = document.querySelector(selector);
      if (el) observer.observe(el);
    }
    window.addEventListener("resize", fitLayout);
    window.visualViewport?.addEventListener("resize", fitLayout);
    fitLayout();
    return { selectTab };
  }

  /* Gràfics SVG senzills, sense biblioteques. */
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pct = (x, digits = 0) =>
    `${(x * 100).toLocaleString("ca", { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`;
  const charts = {
    /* points: [[x, y]], y entre 0 i 1. ref: línia de referència (y). */
    line({ points, ref = 0.5, xMax, label = "" }) {
      const W = 320,
        H = 150,
        L = 34,
        R = 8,
        T = 10,
        B = 22;
      const max = Math.max(1, xMax ?? points.at(-1)?.[0] ?? 1);
      const x = (v) => L + ((W - L - R) * v) / max,
        y = (v) => T + (H - T - B) * (1 - v);
      const path = points
        .map(([a, b], i) => `${i ? "L" : "M"}${x(a).toFixed(1)} ${y(b).toFixed(1)}`)
        .join("");
      const grid = [0, 0.25, 0.5, 0.75, 1]
        .map(
          (v) =>
            `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end" font-size="9" style="fill:var(--muted)">${v * 100}%</text>`,
        )
        .join("");
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}<line x1="${L}" x2="${W - R}" y1="${y(ref)}" y2="${y(ref)}" style="stroke:var(--gold)" stroke-width="1.5" stroke-dasharray="4 3"/>${points.length ? `<path d="${path}" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ""}<text x="${W - R}" y="${H - 6}" text-anchor="end" font-size="9" style="fill:var(--muted)">${max.toLocaleString("ca")} llançaments</text><text x="${L}" y="${H - 6}" font-size="9" style="fill:var(--muted)">0</text></svg>`;
    },
    /* labels[], observed[] i expected[] (freqüències relatives 0–1). */
    bars({ labels, observed, expected = [], label = "" }) {
      const n = labels.length,
        W = 320,
        H = 160,
        L = 30,
        R = 6,
        T = 10,
        B = 24;
      const top = Math.max(0.05, ...observed, ...expected) * 1.12;
      const slot = (W - L - R) / n,
        bw = Math.max(2, slot * 0.68),
        y = (v) => T + (H - T - B) * (1 - v / top);
      const step = top > 0.5 ? 0.25 : top > 0.2 ? 0.1 : top > 0.1 ? 0.05 : 0.02;
      let grid = "";
      for (let v = 0; v <= top + 1e-9; v += step)
        grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/><text x="${L - 5}" y="${y(v) + 3}" text-anchor="end" font-size="8.5" style="fill:var(--muted)">${Math.round(v * 100)}%</text>`;
      const every = Math.ceil(n / 16);
      const body = labels
        .map((lab, i) => {
          const cx = L + slot * i + slot / 2,
            o = observed[i] || 0,
            e = expected[i];
          return `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y(o).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(o)).toFixed(1)}" rx="2" style="fill:var(--accent)" opacity=".85"><title>${esc(lab)}: ${pct(o, 1)}</title></rect>${
            e === undefined
              ? ""
              : `<line x1="${(cx - bw / 2 - 1).toFixed(1)}" x2="${(cx + bw / 2 + 1).toFixed(1)}" y1="${y(e).toFixed(1)}" y2="${y(e).toFixed(1)}" style="stroke:var(--gold)" stroke-width="2.5" stroke-linecap="round"/>`
          }${i % every === 0 ? `<text x="${cx}" y="${H - 9}" text-anchor="middle" font-size="9" style="fill:var(--muted)">${esc(lab)}</text>` : ""}`;
        })
        .join("");
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}${body}</svg>`;
    },
    legend: `<p class="legend"><span><i style="background:var(--accent)"></i>Observat</span><span><i style="background:var(--gold)"></i>Teòric</span></p>`,
  };

  return {
    $,
    esc,
    pct,
    charts,
    reduced,
    cap,
    randomInt,
    randomBetween,
    pick,
    shuffle,
    load,
    save,
    prefs,
    audioReady,
    tone,
    noise,
    sounds,
    toast,
    undoable,
    confetti,
    formatTime,
    download,
    de,
    downloadCsv,
    parseLines,
    copyText,
    renderHistory,
    getClasses,
    setupClasses,
    setPresentation,
    fitLayout,
    init,
  };
})();
