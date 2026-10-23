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
    custom: false,
    customText: "",
    history: [],
    stats: {},
  };
  // Daus personalitzats: cares amb paraules o emojis per a llengua, tutoria o escriptura.
  const PRESETS = {
    pronoms: "jo\ntu\nell / ella\nnosaltres\nvosaltres\nells / elles",
    temps: "present\npassat perifràstic\nimperfet\nfutur\ncondicional\nimperatiu",
    preguntes: "Qui?\nQuè?\nOn?\nQuan?\nCom?\nPer què?",
    emocions: "😀 alegria\n😢 tristesa\n😠 ràbia\n😨 por\n😲 sorpresa\n😌 calma",
  };
  const saved = A.load(KEY, null);
  if (saved && typeof saved === "object") {
    if (Number.isInteger(saved.count)) state.count = Math.min(MAX_DICE, Math.max(1, saved.count));
    if (FACES.includes(saved.faces)) state.faces = saved.faces;
    if (OPS.includes(saved.op)) state.op = saved.op;
    if (typeof saved.colors === "boolean") state.colors = saved.colors;
    if (DURATIONS.includes(saved.duration)) state.duration = saved.duration;
    if (typeof saved.custom === "boolean") state.custom = saved.custom;
    if (typeof saved.customText === "string") state.customText = saved.customText.slice(0, 600);
    if (Array.isArray(saved.history))
      state.history = saved.history
        .filter((h) => h && typeof h.label === "string" && Number.isFinite(h.time))
        .slice(0, 200);
    if (saved.stats && typeof saved.stats === "object") state.stats = saved.stats;
  }
  const persist = () => A.save(KEY, state);
  const customFaces = () =>
    state.customText
      .split(/\r?\n/)
      .map((x) => x.trim().slice(0, 24))
      .filter(Boolean)
      .slice(0, 20);
  if (!state.customText) state.customText = PRESETS.preguntes;
  const isCustom = () => state.custom && customFaces().length >= 2;
  const sides = () => (isCustom() ? customFaces().length : state.faces);
  const faceLabel = (v) => (isCustom() ? customFaces()[v - 1] : String(v));
  // La clau de les estadístiques inclou les cares personalitzades: si canvien, l'estadística és nova.
  const configKey = () => (isCustom() ? `${state.count}c:${customFaces().join("|")}` : `${state.count}d${state.faces}`);
  const configName = () => (isCustom() ? `${state.count} ${state.count === 1 ? "dau amb paraules" : "daus amb paraules"}` : `${state.count} × D${state.faces}`);

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
      return [+(50 + r * Math.cos(a)).toFixed(1), +(50 + r * Math.sin(a)).toFixed(1)];
    });
  }
  const pts = (list) => list.map((p) => p.join(",")).join(" ");
  /* Daus polièdrics vistos de cara: la cara frontal amb el número i les facetes del voltant,
     ombrejades segons una llum que ve de dalt a l'esquerra (valors positius aclareixen, negatius enfosqueixen). */
  function shade(poly) {
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length - 50,
      cy = poly.reduce((a, p) => a + p[1], 0) / poly.length - 50,
      len = Math.hypot(cx, cy) || 1;
    return +((-cx * 0.55 - cy * 0.83) / len * 0.32).toFixed(2);
  }
  function solid(outline, front, facets, ty, size) {
    return { outline, front, facets: facets.map((f) => [f, shade(f)]), ty, size };
  }
  const SHAPES = (() => {
    const shapes = {};
    // D4: tetràedre amb una cara al davant i una franja de la base.
    shapes[4] = solid([[50, 5], [92, 78], [50, 95], [8, 78]], [[50, 5], [92, 78], [8, 78]], [[[8, 78], [92, 78], [50, 95]]], 58, 32);
    // D8: octàedre, triangle frontal i tres facetes laterals.
    const h8 = polygon(6, 47);
    shapes[8] = solid(h8, [h8[0], h8[2], h8[4]], [[h8[0], h8[1], h8[2]], [h8[2], h8[3], h8[4]], [h8[4], h8[5], h8[0]]], 53, 30);
    // D10: trapezoedre, estel frontal.
    const t = [50, 3], r = [95, 44], rb = [80, 76], bt = [50, 97], lb = [20, 76], l = [5, 44],
      kr = [74, 56], kb = [50, 72], kl = [26, 56];
    shapes[10] = solid([t, r, rb, bt, lb, l], [t, kr, kb, kl], [[t, r, kr], [r, rb, kr], [kr, rb, bt, kb], [kl, kb, bt, lb], [l, kl, lb], [t, kl, l]], 46, 25);
    // D12: dodecàedre, pentàgon central envoltat de cinc pentàgons.
    const o12 = polygon(10, 48), i12 = polygon(5, 25);
    shapes[12] = solid(o12, i12, i12.map((p, i) => [p, o12[(2 * i + 9) % 10], o12[2 * i], o12[2 * i + 1], i12[(i + 1) % 5]]), 52, 25);
    // D20: icosàedre, triangle central i nou facetes.
    const h = polygon(6, 48), A = [50, 21], B = [79, 68], C = [21, 68];
    shapes[20] = solid(h, [A, B, C], [[h[0], h[1], A], [h[5], h[0], A], [h[1], B, A], [h[1], h[2], B], [h[2], h[3], B], [h[3], C, B], [h[3], h[4], C], [h[4], h[5], C], [h[5], A, C]], 54, 22);
    return shapes;
  })();
  /* Llum del cub (en coordenades de pantalla: x a la dreta, y avall, z cap a l'espectador). */
  const NORMALS = { 1: [0, 0, 1], 2: [0, -1, 0], 3: [1, 0, 0], 4: [-1, 0, 0], 5: [0, 1, 0], 6: [0, 0, -1] },
    LIGHT = [-0.3, -0.45, 0.84],
    TILT = [-18, 20];
  const rad = (d) => (d * Math.PI) / 180;
  const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
  const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
  const rotZ = ([x, y, z], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
  function lightCube(d) {
    for (const face of d.body.querySelectorAll(".cube-face")) {
      let n = NORMALS[face.dataset.v];
      n = rotY(n, rad(d.y));
      n = rotX(n, rad(d.x));
      n = rotZ(n, rad(d.z));
      n = rotY(n, rad(TILT[1]));
      n = rotX(n, rad(TILT[0]));
      const dot = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
      face.style.setProperty("--dark", (0.42 * (1 - Math.max(0, dot))).toFixed(2));
    }
  }
  /* Trajectòria del llançament: [moment, alçada (fracció de la mida), progrés del gir]. Dos bots que s'apaguen. */
  const PATH = [
    [0, 0, 0],
    [0.17, 0.5, 0.3],
    [0.33, 0.66, 0.52],
    [0.52, 0, 0.8],
    [0.63, 0.2, 0.91],
    [0.75, 0, 0.975],
    [0.83, 0.05, 0.995],
    [0.9, 0, 1],
    [1, 0, 1],
  ];
  function flight(d, transformAt, duration, delay, drift) {
    const size = d.el.offsetWidth,
      frames = PATH.map(([offset, h, p], k) => ({
        offset,
        transform: `translate3d(${(drift * size * Math.sin(Math.PI * p)).toFixed(1)}px, ${(-h * size).toFixed(1)}px, ${(h * size * 0.6).toFixed(1)}px) ${transformAt(p, k)}`,
        easing: PATH[k + 1] && PATH[k + 1][1] > h ? "cubic-bezier(.3,.6,.6,1)" : "cubic-bezier(.45,0,.75,.45)",
      }));
    d.el.querySelector(".die-shadow").animate(
      PATH.map(([offset, h]) => ({ offset, transform: `scale(${(1 - h * 0.7).toFixed(2)})`, opacity: +(1 - h * 0.8).toFixed(2) })),
      { duration, delay },
    );
    return d.body.animate(frames, { duration, delay, fill: "forwards" });
  }

  function buildDice() {
    host.replaceChildren();
    dice = [];
    for (let i = 0; i < state.count; i++) {
      const die = document.createElement("div");
      die.className = `die${state.colors ? "" : " classic"}`;
      if (state.colors) die.style.setProperty("--c", COLORS[i % COLORS.length]);
      die.innerHTML = '<div class="die-shadow"></div>';
      const item = { el: die, value: 1, x: 0, y: 0 };
      if (isCustom()) {
        const tile = document.createElement("div");
        tile.className = "poly custom";
        tile.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><rect class="shape" x="5" y="5" width="90" height="90" rx="20"/><rect class="front" x="11" y="11" width="78" height="78" rx="15"/><rect class="rim" x="5" y="5" width="90" height="90" rx="20"/><text class="num" x="50" y="51"></text></svg>`;
        die.append(tile);
        item.body = tile;
        item.value = 1 + (i % sides());
      } else if (state.faces === 6) {
        const tilt = document.createElement("div"),
          cube = document.createElement("div");
        tilt.className = "cube-tilt";
        tilt.style.transform = `rotateX(${TILT[0]}deg) rotateY(${TILT[1]}deg)`;
        cube.className = "cube";
        // Un cub interior una mica més petit omple les cantonades arrodonides i fa de bisell.
        cube.innerHTML =
          Object.values(FACE_POS)
            .map((pos) => `<div class="cube-core" style="transform:${pos.replace("var(--h)", "calc(var(--h) * 0.94)")}"></div>`)
            .join("") +
          Object.entries(PIPS)
            .map(([v, pips]) => `<div class="cube-face" data-v="${v}" style="transform:${FACE_POS[v]}">${Array.from({ length: 9 }, (_, k) => (pips.includes(k + 1) ? '<span class="pip"></span>' : "<span></span>")).join("")}</div>`)
            .join("");
        tilt.append(cube);
        die.append(tilt);
        item.body = cube;
        const start = 1 + (i % 6);
        item.value = start;
        item.z = 0;
        [item.x, item.y] = SHOW[start];
        cube.style.transform = `rotateZ(0deg) rotateX(${item.x}deg) rotateY(${item.y}deg)`;
        lightCube(item);
      } else {
        const g = SHAPES[state.faces],
          poly = document.createElement("div");
        poly.className = "poly";
        poly.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><polygon class="shape" points="${pts(g.outline)}"/>${g.facets
          .map(([f, k]) => `<polygon class="facet" points="${pts(f)}" fill="${k > 0 ? "#fff" : "#000"}" fill-opacity="${Math.abs(k)}"/>`)
          .join("")}<polygon class="front" points="${pts(g.front)}"/><polygon class="rim" points="${pts(g.outline)}"/><text class="num" x="50" y="${g.ty}" font-size="${g.size}">${state.faces}</text></svg>`;
        die.append(poly);
        item.body = poly;
        item.value = state.faces;
      }
      host.append(die);
      dice.push(item);
    }
    setNumberStyle();
    host.setAttribute("aria-label", isCustom() ? configName() : `${state.count} ${state.count === 1 ? "dau" : "daus"} de ${state.faces} cares`);
    sizeDice();
  }
  function setNumberStyle() {
    for (const d of dice) {
      const text = d.body.querySelector?.(".num");
      if (!text) continue;
      if (isCustom()) {
        // Les etiquetes llargues es parteixen en dues línies i la lletra s'ajusta a la cara.
        const label = faceLabel(d.value),
          words = label.split(" "),
          emoji = /^\p{Extended_Pictographic}/u.test(label),
          half = emoji ? 1 : Math.ceil(words.length / 2),
          lines = words.length > 1 && (emoji || [...label].length > 9) ? [words.slice(0, half).join(" "), words.slice(half).join(" ")] : [label],
          longest = Math.max(...lines.map((l) => [...l].length)),
          size = Math.max(9, Math.min(34, 132 / Math.max(3, longest)));
        text.replaceChildren(
          ...lines.map((line, k) => {
            const span = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            span.setAttribute("x", "50");
            span.setAttribute("dy", String(k ? size * 1.1 : lines.length > 1 ? -size * 0.55 : 0));
            span.textContent = line;
            return span;
          }),
        );
        text.setAttribute("font-size", size.toFixed(1));
        continue;
      }
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
      b.setAttribute("aria-pressed", String(b.dataset.faces === "custom" ? state.custom : !state.custom && Number(b.dataset.faces) === state.faces));
      b.disabled = busy;
    }
    for (const b of document.querySelectorAll("[data-op]")) b.setAttribute("aria-pressed", String(b.dataset.op === state.op));
    $("customBox").hidden = !state.custom;
    $("opField").hidden = isCustom();
    if (document.activeElement !== $("customInput")) $("customInput").value = state.customText;
    $("customNote").textContent = `${customFaces().length} cares${customFaces().length < 2 ? " · escriu-ne almenys dues" : ""}`;
    $("predictField").hidden = isCustom();
    $("predictLabel").textContent =
      state.count > 1 && state.op === "product" ? "Abans de simular: quin producte sortirà més vegades?" : `Abans de simular: quin${state.count > 1 ? "a suma" : " valor"} sortirà més vegades?`;
    for (const b of document.querySelectorAll("[data-simulate]")) b.disabled = busy;
    $("colorToggle").checked = state.colors;
    $("durationInput").value = String(state.duration);
    $("rollButton").disabled = busy;
    $("rollLabel").textContent = state.count === 1 ? "Llança el dau" : `Llança ${state.count} daus`;
    $("stageSubtitle").textContent = isCustom()
      ? `${configName()} · ${sides()} cares`
      : `${state.count} ${state.count === 1 ? "dau" : "daus"} de ${state.faces} cares${state.count > 1 && state.op !== "none" ? ` · ${state.op === "sum" ? "suma" : "producte"}` : ""}`;
  }

  function describe(values) {
    if (isCustom()) return values.map(faceLabel).join(" · ");
    if (values.length === 1) return String(values[0]);
    if (state.op === "sum") return `${values.join(" + ")} = ${values.reduce((a, b) => a + b, 0)}`;
    if (state.op === "product") return `${values.join(" × ")} = ${values.reduce((a, b) => a * b, 1)}`;
    return values.join(" · ");
  }
  function record(values) {
    const key = configKey();
    if (isCustom()) {
      // Cares amb paraules: es compta cada cara de cada dau.
      const s = (state.stats[key] ||= { rolls: 0, faces: Array(sides()).fill(0) });
      s.rolls++;
      for (const v of values) s.faces[v - 1]++;
      return;
    }
    const s = (state.stats[key] ||= { rolls: 0, counts: Array(state.count * (state.faces - 1) + 1).fill(0) });
    s.rolls++;
    s.counts[values.reduce((a, b) => a + b, 0) - state.count]++;
    const product = values.reduce((a, b) => a * b, 1);
    s.prod ||= {};
    s.prod[product] = (s.prod[product] || 0) + 1;
  }
  function showResult(values) {
    const line = $("resultLine"),
      big = document.createElement("span");
    big.className = "big";
    big.textContent = describe(values);
    line.replaceChildren(big);
    if (state.colors && values.length > 1 && (state.op === "none" || isCustom())) {
      const detail = document.createElement("span");
      detail.textContent = values.map((v, i) => `${COLOR_NAMES[i]}: ${faceLabel(v)}`).join(" · ");
      line.append(detail);
    }
  }

  function roll() {
    if (busy) return;
    A.audioReady();
    busy = true;
    syncControls();
    $("resultLine").textContent = "";
    const values = dice.map(() => 1 + A.randomInt(sides())),
      motion = !A.reduced.matches;
    const done = dice.map((d, i) => {
      d.el.classList.remove("landed");
      const duration = state.duration * (0.9 + A.randomInt(201) / 1000),
        delay = i * 60,
        drift = (A.randomInt(41) - 20) / 100;
      for (let k = 0; k < Math.max(3, Math.round(duration / 160)); k++)
        setTimeout(() => A.noise(0.03, 0, 0.16, 1800 + A.randomInt(1400)), delay + (k * duration * 0.75) / Math.max(3, Math.round(duration / 160)));
      setTimeout(() => A.noise(0.06, 0, 0.3, 1200), delay + duration * 0.85);
      if (!isCustom() && state.faces === 6) {
        const [tx, ty] = SHOW[values[i]],
          ox = d.x,
          oy = d.y,
          oz = d.z,
          spins = 2 + Math.round(state.duration / 900),
          x = d.x - (((d.x % 360) + 360) % 360) + 360 * (spins + A.randomInt(2)) + tx,
          y = d.y - (((d.y % 360) + 360) % 360) + 360 * (spins + A.randomInt(2)) + ty,
          z = A.randomInt(41) - 20,
          final = `translate3d(0px, 0px, 0px) rotateZ(${z}deg) rotateX(${x}deg) rotateY(${y}deg)`;
        Object.assign(d, { x, y, z, value: values[i] });
        if (!motion) {
          d.body.style.transform = final;
          lightCube(d);
          return Promise.resolve();
        }
        for (const face of d.body.querySelectorAll(".cube-face")) face.style.setProperty("--dark", "0.12");
        const anim = flight(d, (p) => `rotateZ(${(oz + (z - oz) * p).toFixed(1)}deg) rotateX(${(ox + (x - ox) * p).toFixed(1)}deg) rotateY(${(oy + (y - oy) * p).toFixed(1)}deg)`, duration, delay, drift);
        return anim.finished.then(() => {
          d.body.style.transform = final;
          anim.cancel();
          lightCube(d);
          d.el.classList.add("landed");
        });
      }
      // Daus polièdrics: giren i s'inclinen (sense posar-se mai de cantell) mentre canvien de número.
      const dir = A.randomInt(2) ? 1 : -1,
        turns = dir * 360 * (1 + Math.round(state.duration / 1000)),
        wobX = 34 + A.randomInt(16),
        wobY = 28 + A.randomInt(16),
        tiltEnd = A.randomInt(25) - 12,
        prevTilt = d.tilt || 0;
      d.tilt = tiltEnd;
      if (!motion) {
        d.value = values[i];
        setNumberStyle();
        return Promise.resolve();
      }
      let stop = false;
      (function flicker(wait) {
        if (stop) return;
        d.value = 1 + A.randomInt(sides());
        setNumberStyle();
        setTimeout(() => flicker(Math.min(260, wait * 1.12)), wait);
      })(55);
      const anim = flight(d, (p) => `rotate(${(prevTilt + (turns + tiltEnd - prevTilt) * p).toFixed(1)}deg) rotateX(${(Math.sin(p * Math.PI * 4) * wobX * (1 - p)).toFixed(1)}deg) rotateY(${(Math.sin(p * Math.PI * 3) * wobY * (1 - p)).toFixed(1)}deg)`, duration, delay, drift);
      return anim.finished.then(() => {
        stop = true;
        d.body.style.transform = `rotate(${tiltEnd}deg)`;
        anim.cancel();
        d.value = values[i];
        setNumberStyle();
        d.el.classList.add("landed");
      });
    });
    Promise.all(done).then(() => {
      busy = false;
      record(values);
      showResult(values);
      state.history.unshift({ label: describe(values), detail: isCustom() ? configName() : `${state.count}d${state.faces}`, time: Date.now() });
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
    const product = !isCustom() && state.count > 1 && state.op === "product",
      seen = new Map();
    let total = 0;
    for (let t = 0; t < times; t++) {
      const values = Array.from({ length: state.count }, () => 1 + A.randomInt(sides()));
      const v = product ? values.reduce((a, b) => a * b, 1) : values.reduce((a, b) => a + b, 0);
      total += v;
      seen.set(v, (seen.get(v) || 0) + 1);
      record(values);
    }
    const fmt = (v) => v.toLocaleString("ca", { maximumFractionDigits: 2 });
    let label;
    if (isCustom()) label = `Simulació: ${times.toLocaleString("ca")} tirades de ${configName()}`;
    else {
      label = `Simulació: ${times.toLocaleString("ca")} tirades de ${state.count}D${state.faces} → ${product ? "producte" : state.count > 1 ? "suma" : "valor"} mitjà ${fmt(total / times)}`;
      const top = Math.max(...seen.values()),
        winners = [...seen].filter(([, c]) => c === top).map(([v]) => v).sort((a, b) => a - b),
        raw = $("predictInput").value.trim(),
        guess = Number(raw);
      if (raw && Number.isFinite(guess)) label += ` · predicció: ${fmt(guess)}; el més freqüent ha estat el ${winners.map(fmt).join(" i el ")}${winners.includes(guess) ? " ✓" : ""}`;
    }
    state.history.unshift({ label, detail: configName(), time: Date.now() });
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
  /* Distribució teòrica del producte: es multiplica dau a dau sobre un mapa de valors. */
  function theoreticalProduct(count, faces) {
    let dist = new Map([[1, 1]]);
    for (let d = 0; d < count; d++) {
      const next = new Map();
      for (const [v, p] of dist) for (let f = 1; f <= faces; f++) next.set(v * f, (next.get(v * f) || 0) + p / faces);
      dist = next;
    }
    return [...dist].sort((a, b) => a[0] - b[0]);
  }
  function renderStats() {
    const s = state.stats[configKey()],
      rolls = s?.rolls || 0,
      product = !isCustom() && state.count > 1 && state.op === "product",
      expectedMean = product ? ((state.faces + 1) / 2) ** state.count : (state.count * (state.faces + 1)) / 2;
    const fmt = (v) => v.toLocaleString("ca", { maximumFractionDigits: 2 });
    $("statRolls").textContent = rolls.toLocaleString("ca");
    $("statConfig").textContent = configName();
    $("statMeanLabel").textContent = product ? "Producte mitjà" : "Mitjana";
    if (isCustom()) {
      const labels = customFaces(),
        counts = s?.faces || [],
        n = counts.reduce((a, b) => a + b, 0);
      $("statMeanLabel").textContent = "Cares";
      $("statMean").textContent = labels.length;
      $("statExpected").textContent = `${A.pct(1 / labels.length, 1)} cadascuna`;
      $("distChart").innerHTML =
        A.charts.bars({ labels: labels.map((l) => [...l].slice(0, 6).join("")), observed: labels.map((_, i) => (n ? (counts[i] || 0) / n : 0)), expected: labels.map(() => 1 / labels.length), label: "Freqüència de cada cara" }) + A.charts.legend;
      $("distCaption").textContent = n
        ? `Quantes vegades ha sortit cada cara (${n.toLocaleString("ca")} cares en ${rolls.toLocaleString("ca")} tirades). Totes tenen la mateixa probabilitat.`
        : "Encara no hi ha tirades amb aquest dau. Totes les cares tenen la mateixa probabilitat.";
      return;
    }
    $("statExpected").textContent = `${product ? "teòric" : "teòrica"} ${fmt(expectedMean)}`;
    if (product) {
      const theory = theoreticalProduct(state.count, state.faces),
        prod = s?.prod || {},
        n = Object.values(prod).reduce((a, b) => a + b, 0);
      $("statMean").textContent = n ? fmt(Object.entries(prod).reduce((a, [v, c]) => a + v * c, 0) / n) : "—";
      $("distChart").innerHTML =
        A.charts.bars({ labels: theory.map(([v]) => String(v)), observed: theory.map(([v]) => (n ? (prod[v] || 0) / n : 0)), expected: theory.map(([, p]) => p), label: "Distribució del producte" }) + A.charts.legend;
      $("distCaption").textContent = `Producte de ${state.count} × D${state.faces}: només hi ha ${theory.length} resultats possibles, i alguns es poden obtenir de moltes maneres (amb dos D6, el 12 surt de 2 × 6, 3 × 4, 4 × 3 i 6 × 2). ${n ? `${n.toLocaleString("ca")} tirades.` : "Encara no hi ha tirades en mode producte."}`;
      return;
    }
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
      if (b.dataset.faces === "custom") state.custom = true;
      else {
        state.custom = false;
        state.faces = Number(b.dataset.faces);
      }
      changed();
    });
  let customTimer;
  $("customInput").addEventListener("input", (e) => {
    clearTimeout(customTimer);
    customTimer = setTimeout(() => {
      state.customText = e.target.value.slice(0, 600);
      changed();
    }, 300);
  });
  for (const b of document.querySelectorAll("[data-preset]"))
    b.addEventListener("click", () => {
      state.customText = PRESETS[b.dataset.preset];
      $("customInput").value = state.customText;
      changed();
    });
  for (const b of document.querySelectorAll("[data-op]"))
    b.addEventListener("click", () => {
      state.op = b.dataset.op;
      syncControls();
      renderStats();
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
    const key = configKey(),
      before = state.stats[key];
    delete state.stats[key];
    persist();
    renderStats();
    A.undoable("Estadística d’aquesta configuració reiniciada.", () => {
      if (before) state.stats[key] = before;
      persist();
      renderStats();
    });
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
