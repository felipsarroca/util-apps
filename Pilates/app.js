(() => {
  "use strict";

  const CATALOG = window.PILATES_CATALOG;
  const STORAGE_KEY = "pilates-a-ma-state";
  const SCHEMA_VERSION = 1;
  const LEVEL_LABELS = { beginner: "Iniciació", mixed: "Iniciació / intermedi", intermediate: "Intermedi", advanced: "Intermedi-avançat" };
  const REASONS = {
    NEXT_IN_ACTIVE_PROGRAM: "És la següent sessió del teu programa.",
    START_ACTIVE_PROGRAM: "És el primer pas del programa que tens seleccionat.",
    MATCHES_DURATION: "Encaixa amb el temps que tens habitualment.",
    KNEE_SELECTION: "Forma part de la selecció sense forçar els genolls.",
    MATCHES_LEVEL: "Coincideix amb el teu nivell habitual.",
    FULL_BODY: "És una classe de cos complet.",
    DURATION_RELAXED: "És l'opció més pròxima, tot i que dura una mica més."
  };

  const defaultState = () => ({
    schemaVersion: SCHEMA_VERSION,
    preferences: { level: "beginner", duration: 30, prioritizeKnee: true },
    favorites: [],
    sessions: [],
    programCycles: {},
    activeProgramId: "beginner-15",
    customVideos: [],
    installDismissedAt: null
  });

  let state = loadState();
  let currentRoute = "avui";
  let currentSession = null;
  let player = null;
  let playerTimer = null;
  let youtubeApiPromise = null;
  let deferredInstallPrompt = null;
  let wakeLock = null;
  let toastTimer = null;
  let lastFocusedElement = null;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const nowIso = () => new Date().toISOString();
  const thumb = id => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  const fallbackThumb = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const thumbAttrs = id => `src="${thumb(id)}" data-thumb-id="${id}"`;
  const minutes = seconds => Math.max(1, Math.round(seconds / 60));
  const formatPosition = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return defaultState();
      return { ...defaultState(), ...parsed, preferences: { ...defaultState().preferences, ...parsed.preferences } };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function allVideos() {
    return [...CATALOG.videos, ...state.customVideos];
  }

  function getVideo(id) {
    return allVideos().find(video => video.id === id);
  }

  function getProgram(id) {
    return CATALOG.programs.find(program => program.id === id);
  }

  function getCycles(programId) {
    return state.programCycles[programId] || [];
  }

  function getActiveCycle(programId) {
    const cycles = getCycles(programId);
    return [...cycles].reverse().find(cycle => !cycle.archived) || null;
  }

  function ensureActiveCycle(programId) {
    let cycle = getActiveCycle(programId);
    if (cycle && !cycle.completedAt) return cycle;
    cycle = { id: uid(), startedAt: nowIso(), completedAt: null, completedVideoIds: [], archived: false };
    state.programCycles[programId] = [...getCycles(programId).map(item => ({ ...item, archived: true })), cycle];
    state.activeProgramId = programId;
    saveState();
    return cycle;
  }

  function cycleProgress(programId) {
    const program = getProgram(programId);
    const cycle = getActiveCycle(programId);
    const completed = cycle ? program.items.filter(id => cycle.completedVideoIds.includes(id)).length : 0;
    return { cycle, completed, total: program.items.length, percent: Math.round((completed / program.items.length) * 100) };
  }

  function nextInProgram(programId) {
    const program = getProgram(programId);
    const cycle = getActiveCycle(programId);
    if (!cycle) return program.items[0];
    return program.items.find(id => !cycle.completedVideoIds.includes(id)) || null;
  }

  function completedCycles(programId) {
    return getCycles(programId).filter(cycle => cycle.completedAt).length;
  }

  function latestSessionFor(videoId) {
    return [...state.sessions].reverse().find(session => session.videoId === videoId);
  }

  function videoStatus(videoId) {
    const sessions = state.sessions.filter(session => session.videoId === videoId);
    if (sessions.some(session => session.completedAt)) return "completed";
    if (sessions.length) return "started";
    return "unseen";
  }

  function completedCount() {
    return new Set(state.sessions.filter(session => session.completedAt).map(session => session.videoId)).size;
  }

  function currentRecommendation() {
    const activeProgram = getProgram(state.activeProgramId) || CATALOG.programs[0];
    const nextId = nextInProgram(activeProgram.id);
    if (nextId) {
      const hasCycle = Boolean(getActiveCycle(activeProgram.id));
      return {
        videoId: nextId,
        programId: activeProgram.id,
        reasonCodes: [hasCycle ? "NEXT_IN_ACTIVE_PROGRAM" : "START_ACTIVE_PROGRAM"],
        alternatives: recommendationAlternatives(nextId)
      };
    }

    const candidates = allVideos().filter(video => video.level !== "advanced" && videoStatus(video.id) !== "completed");
    const preferred = candidates.filter(video => {
      const levelMatch = video.level === state.preferences.level || (state.preferences.level === "beginner" && video.level === "mixed");
      const durationMatch = Math.abs(minutes(video.duration) - state.preferences.duration) <= 10;
      const kneeMatch = !state.preferences.prioritizeKnee || video.tags.includes("knee-selection");
      return levelMatch && durationMatch && kneeMatch;
    });
    const video = preferred[0] || candidates[0] || CATALOG.videos[0];
    const reasons = [];
    if (video.tags.includes("knee-selection")) reasons.push("KNEE_SELECTION");
    if (video.level === state.preferences.level) reasons.push("MATCHES_LEVEL");
    if (Math.abs(minutes(video.duration) - state.preferences.duration) <= 10) reasons.push("MATCHES_DURATION");
    if (video.tags.includes("full-body")) reasons.push("FULL_BODY");
    return { videoId: video.id, programId: null, reasonCodes: reasons.length ? reasons : ["DURATION_RELAXED"], alternatives: recommendationAlternatives(video.id) };
  }

  function recommendationAlternatives(excludeId) {
    const videos = allVideos().filter(video => video.id !== excludeId && video.level !== "advanced");
    const short = videos.filter(video => video.duration <= 1800).sort((a, b) => a.duration - b.duration)[0];
    const knee = videos.find(video => video.tags.includes("knee-selection") && videoStatus(video.id) !== "completed");
    return [...new Set([short?.id, knee?.id].filter(Boolean))].slice(0, 2);
  }

  function renderAll() {
    renderToday();
    renderPrograms();
    renderExplore();
    renderHistory();
    renderSettings();
    updateInstallUi();
  }

  function renderToday() {
    const date = new Intl.DateTimeFormat("ca", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    $("#today-date").textContent = date.charAt(0).toUpperCase() + date.slice(1);
    const recommendation = currentRecommendation();
    const video = getVideo(recommendation.videoId);
    const program = recommendation.programId ? getProgram(recommendation.programId) : null;
    const progress = program ? cycleProgress(program.id) : null;
    const reasonText = recommendation.reasonCodes.map(code => REASONS[code]).filter(Boolean);

    $("#recommendation-slot").innerHTML = `
      <article class="hero-card">
        <img class="hero-image" ${thumbAttrs(video.id)} alt="" fetchpriority="high">
        <div class="hero-content">
          <p class="eyebrow">${program ? escapeHtml(program.title) : "Recomanada per a tu"}</p>
          <h2>${escapeHtml(video.title)}</h2>
          <p>${escapeHtml(reasonText[0] || "Una classe adequada per continuar avançant.")}</p>
          <div class="hero-meta"><span class="pill">${minutes(video.duration)} min</span><span class="pill">${LEVEL_LABELS[video.level]}</span>${video.tags.includes("knee-selection") ? '<span class="pill">Selecció genolls</span>' : ""}</div>
          ${progress ? `<div class="progress-line"><div class="progress-track" aria-label="${progress.completed} de ${progress.total} sessions"><span style="width:${progress.percent}%"></span></div><small>${progress.completed}/${progress.total}</small></div>` : ""}
          <div class="hero-actions">
            <button class="button primary" type="button" data-play="${video.id}" ${program ? `data-program="${program.id}"` : ""}>${latestSessionFor(video.id)?.lastPositionSeconds > 30 ? "Continua" : "Comença la classe"}</button>
            <button class="button secondary why-button" type="button" aria-label="Per què aquesta classe?" aria-expanded="false">Per què?</button>
          </div>
          <div class="recommendation-reasons" hidden><ul>${reasonText.map(reason => `<li>${escapeHtml(reason)}</li>`).join("")}</ul></div>
        </div>
      </article>`;

    $("#quick-grid").innerHTML = beginnerChallengeCardHtml("today") + CATALOG.collections.map(collection => `
      <button class="quick-card quick-${collection.id}" type="button" data-collection="${collection.id}">
        <span class="quick-icon icon-${collection.id}" aria-hidden="true">${collectionIcon(collection.id)}</span>
        <span><strong>${escapeHtml(collection.title)}</strong><small>${escapeHtml(collection.subtitle)}</small></span>
      </button>`).join("");

    const recent = [...state.sessions].reverse().slice(0, 3);
    $("#recent-slot").innerHTML = recent.length ? `<div class="recent-list">${recent.map(recentItemHtml).join("")}</div>` : `
      <div class="empty-state"><strong>Encara no hi ha activitat</strong>Quan comencis una classe, la trobaràs aquí per reprendre-la fàcilment.</div>`;
  }

  function renderPrograms() {
    $("#program-grid").innerHTML = CATALOG.programs.map(program => {
      const progress = cycleProgress(program.id);
      const next = nextInProgram(program.id);
      const rounds = completedCycles(program.id);
      return `<article class="program-card ${program.accent}">
        <div><p class="eyebrow">${escapeHtml(program.subtitle)}</p><h2>${escapeHtml(program.title)}</h2><p>${escapeHtml(program.description)}</p></div>
        <div class="program-bottom">
          <div class="progress-line"><div class="progress-track" aria-label="${progress.completed} de ${progress.total} sessions"><span style="width:${progress.percent}%"></span></div><small>${progress.completed}/${progress.total}</small></div>
          <button class="button" type="button" data-open-program="${program.id}">${next ? (progress.cycle ? "Continua el programa" : "Comença el programa") : "Programa completat"}</button>
          ${rounds ? `<p class="rounds-copy">${rounds} ${rounds === 1 ? "volta completada" : "voltes completades"}</p>` : ""}
        </div>
      </article>`;
    }).join("");
  }

  function openProgram(programId) {
    const program = getProgram(programId);
    const progress = cycleProgress(programId);
    const nextId = nextInProgram(programId);
    state.activeProgramId = programId;
    saveState();
    $("#program-dialog-title").textContent = program.title;
    $("#program-dialog-content").innerHTML = `
      <div class="program-overview"><p>${escapeHtml(program.description)}</p><div class="progress-line"><div class="progress-track"><span style="width:${progress.percent}%"></span></div><small>${progress.completed}/${progress.total}</small></div>${program.healthNote ? '<div class="health-note">Selecció basada en els títols publicats pel canal. Si notes dolor, atura la sessió i consulta un professional.</div>' : ""}</div>
      <div class="program-list">${program.items.map((id, index) => {
        const video = getVideo(id);
        const done = progress.cycle?.completedVideoIds.includes(id);
        return `<div class="program-item ${done ? "completed" : ""} ${id === nextId ? "next" : ""}"><span class="order">${done ? "✓" : index + 1}</span><div><strong>${escapeHtml(video.title)}</strong><p>${minutes(video.duration)} min · ${LEVEL_LABELS[video.level]}</p></div><button type="button" data-play="${id}" data-program="${programId}">${done ? "Repeteix" : id === nextId ? "Ara" : "Obre"}</button></div>`;
      }).join("")}</div>
      ${!nextId ? `<div class="button-row" style="margin-top:18px"><button class="button primary" type="button" data-new-cycle="${programId}">Comença una nova volta</button></div>` : ""}`;
    showDialog($("#program-dialog"));
  }

  function renderExplore() {
    const search = $("#search-input")?.value.trim().toLocaleLowerCase("ca") || "";
    const level = $("#level-filter")?.value || "";
    const duration = $("#duration-filter")?.value || "";
    const type = $("#type-filter")?.value || "";
    const status = $("#status-filter")?.value || "";

    const beginnerProgram = getProgram("beginner-15");
    const beginnerIds = new Set(beginnerProgram?.items || []);
    const challengeHaystack = `${beginnerProgram?.title || ""} ${beginnerProgram?.subtitle || ""} pilates para principiantes pilates per a principiants ${(beginnerProgram?.items || []).map(id => {
      const video = getVideo(id);
      return `${video?.title || ""} ${video?.originalTitle || ""}`;
    }).join(" ")}`.toLocaleLowerCase("ca");
    const showBeginnerChallenge = !type && !duration && !status && (!level || level === "beginner") && (!search || challengeHaystack.includes(search));

    let videos = allVideos().filter(video => !beginnerIds.has(video.id)).filter(video => {
      const haystack = `${video.title} ${video.originalTitle || ""}`.toLocaleLowerCase("ca");
      if (search && !haystack.includes(search)) return false;
      if (level && video.level !== level) return false;
      if (type && !video.tags.includes(type)) return false;
      if (duration === "short" && video.duration >= 1200) return false;
      if (duration === "medium" && (video.duration < 1200 || video.duration > 2100)) return false;
      if (duration === "long" && (video.duration <= 2100 || video.duration > 3000)) return false;
      if (duration === "extended" && video.duration <= 3000) return false;
      const currentStatus = videoStatus(video.id);
      if (status === "favorite" && !state.favorites.includes(video.id)) return false;
      if (status && status !== "favorite" && currentStatus !== status) return false;
      return true;
    });
    videos.sort((a, b) => Number(state.favorites.includes(b.id)) - Number(state.favorites.includes(a.id)) || a.duration - b.duration);
    $("#explore-program-spotlight").innerHTML = showBeginnerChallenge ? beginnerChallengeCardHtml("explore") : "";
    $("#result-count").textContent = `${videos.length} ${videos.length === 1 ? "classe" : "classes"}${showBeginnerChallenge ? " + repte de 15 dies" : ""}`;
    $("#video-grid").innerHTML = videos.length ? videos.map(videoCardHtml).join("") : `<div class="empty-state"><strong>No hi ha cap coincidència</strong>Prova de retirar algun filtre o d'escriure una cerca més curta.</div>`;
  }

  function videoCardHtml(video) {
    const status = videoStatus(video.id);
    const favorite = state.favorites.includes(video.id);
    return `<article class="video-card">
      <div class="video-image-wrap"><img ${thumbAttrs(video.id)} alt="" loading="lazy"><span class="duration-badge">${minutes(video.duration)} min</span>${status !== "unseen" ? `<span class="status-badge ${status}">${status === "completed" ? "✓ Completada" : "En curs"}</span>` : ""}</div>
      <div class="video-body"><h3>${escapeHtml(video.title)}</h3><div class="video-meta"><span>${LEVEL_LABELS[video.level]}</span>${video.tags.includes("knee-selection") ? "<span>Selecció genolls</span>" : ""}${video.custom ? "<span>Personal</span>" : ""}</div>
      <div class="video-actions"><button class="button primary" type="button" data-play="${video.id}">${status === "started" ? "Continua" : status === "completed" ? "Repeteix" : "Comença"}</button><button class="favorite-button ${favorite ? "active" : ""}" type="button" data-favorite="${video.id}" aria-label="${favorite ? "Retira de preferides" : "Afegeix a preferides"}" aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button></div></div>
    </article>`;
  }

  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function beginnerChallengeCardHtml(context = "explore") {
    const program = getProgram("beginner-15");
    if (!program) return "";
    const progress = cycleProgress(program.id);
    const nextId = nextInProgram(program.id) || program.items[0];
    const nextVideo = getVideo(nextId);
    const representativeIds = [program.items[0], program.items[7], program.items[14]];
    const action = progress.completed === progress.total ? "Torna a començar" : progress.completed ? `Continua pel dia ${progress.completed + 1}` : "Comença pel dia 1";
    return `<button class="beginner-challenge-card ${context}" type="button" data-start-program="${program.id}" aria-label="${action}: ${escapeHtml(program.title)}">
      <span class="challenge-collage" aria-hidden="true">
        ${representativeIds.map(id => `<img ${thumbAttrs(id)} alt="" loading="lazy">`).join("")}
        <span class="challenge-count">15 sessions</span>
      </span>
      <span class="challenge-copy">
        <span class="eyebrow">Pilates per a principiants</span>
        <strong>${escapeHtml(program.title)}</strong>
        <small>${escapeHtml(nextVideo.title)} · ${minutes(nextVideo.duration)} min</small>
        <span class="challenge-progress"><span style="width:${progress.percent}%"></span></span>
        <span class="challenge-action">${action} <span aria-hidden="true">→</span></span>
      </span>
    </button>`;
  }

  function startOfWeek(value = new Date()) {
    const date = startOfDay(value);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return date;
  }

  function addDays(value, days) {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
  }

  function dayKey(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function sessionActivityDate(session) {
    return new Date(session.completedAt || session.startedAt);
  }

  function completedMinutes(sessions) {
    return sessions.reduce((sum, session) => sum + minutes(getVideo(session.videoId)?.duration || 0), 0);
  }

  function sessionsBetween(sessions, start, end) {
    return sessions.filter(session => {
      const date = new Date(session.completedAt);
      return date >= start && date < end;
    });
  }

  function renderHistory() {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const nextWeek = addDays(weekStart, 7);
    const previousWeek = addDays(weekStart, -7);
    const completedSessions = state.sessions.filter(session => session.completedAt && getVideo(session.videoId));
    const thisWeek = sessionsBetween(completedSessions, weekStart, nextWeek);
    const lastWeek = sessionsBetween(completedSessions, previousWeek, weekStart);
    const weekMinutes = completedMinutes(thisWeek);
    const previousMinutes = completedMinutes(lastWeek);
    const activeDays = new Set(thisWeek.map(session => dayKey(session.completedAt))).size;

    $("#history-summary").innerHTML = `
      <div class="summary-card"><strong>${thisWeek.length}</strong><span>${thisWeek.length === 1 ? "sessió feta" : "sessions fetes"}</span></div>
      <div class="summary-card"><strong>${weekMinutes}</strong><span>minuts</span></div>
      <div class="summary-card"><strong>${activeDays}</strong><span>${activeDays === 1 ? "dia actiu" : "dies actius"}</span></div>`;

    const difference = weekMinutes - previousMinutes;
    let trend = "Encara no hi ha activitat aquesta setmana.";
    if (weekMinutes && !previousMinutes) trend = `${weekMinutes} min més que la setmana passada`;
    else if (difference > 0) trend = `↑ ${difference} min més que la setmana passada`;
    else if (difference < 0) trend = `↓ ${Math.abs(difference)} min menys que la setmana passada`;
    else if (weekMinutes) trend = "El mateix temps que la setmana passada";
    $("#history-trend").textContent = trend;

    const completedByDay = new Map();
    thisWeek.forEach(session => completedByDay.set(dayKey(session.completedAt), (completedByDay.get(dayKey(session.completedAt)) || 0) + 1));
    $("#history-week-strip").innerHTML = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const count = completedByDay.get(dayKey(date)) || 0;
      const isToday = dayKey(date) === dayKey(now);
      const weekday = new Intl.DateTimeFormat("ca", { weekday: "short" }).format(date).replace(".", "");
      const label = `${weekday}, ${date.getDate()}: ${count} ${count === 1 ? "sessió" : "sessions"}`;
      return `<div class="week-day ${count ? "active" : ""} ${isToday ? "today" : ""}" aria-label="${label}"><span>${weekday}</span><strong>${date.getDate()}</strong><i aria-hidden="true">${count || ""}</i></div>`;
    }).join("");

    renderHistoryInsights(completedSessions);
    renderHistoryContinue();
    renderHistoryPrograms();
    renderHistoryActivity(now);
  }

  function renderHistoryInsights(completedSessions) {
    const totalMinutes = completedMinutes(completedSessions);
    const uniqueVideos = new Set(completedSessions.map(session => session.videoId));
    const repetitions = Math.max(0, completedSessions.length - uniqueVideos.size);
    const rounds = CATALOG.programs.reduce((sum, program) => sum + completedCycles(program.id), 0);
    const repeatCounts = completedSessions.reduce((counts, session) => counts.set(session.videoId, (counts.get(session.videoId) || 0) + 1), new Map());
    const mostRepeated = [...repeatCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const tagLabels = { "full-body": "Cos complet", strength: "Força", mobility: "Mobilitat", core: "Centre abdominal", technique: "Fonaments" };
    const tagCounts = completedSessions.reduce((counts, session) => {
      const video = getVideo(session.videoId);
      Object.keys(tagLabels).forEach(tag => { if (video?.tags.includes(tag)) counts.set(tag, (counts.get(tag) || 0) + 1); });
      return counts;
    }, new Map());
    const practicedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topLevel = [...completedSessions.reduce((counts, session) => {
      const level = getVideo(session.videoId)?.level;
      if (level) counts.set(level, (counts.get(level) || 0) + 1);
      return counts;
    }, new Map()).entries()].sort((a, b) => b[1] - a[1])[0];

    $("#history-insights").innerHTML = `
      <div class="section-heading compact"><div><p class="eyebrow">Perspectiva</p><h2 id="history-insights-title">El teu progrés</h2></div></div>
      <div class="history-metric-grid">
        <div><strong>${uniqueVideos.size}</strong><span>classes diferents</span></div>
        <div><strong>${repetitions}</strong><span>repeticions</span></div>
        <div><strong>${rounds}</strong><span>voltes completes</span></div>
      </div>
      ${completedSessions.length ? `<p class="history-insight-copy">En total: <strong>${completedSessions.length}</strong> sessions i <strong>${totalMinutes}</strong> minuts.${topLevel ? ` Nivell principal: <strong>${LEVEL_LABELS[topLevel[0]].toLocaleLowerCase("ca")}</strong>.` : ""}${mostRepeated?.[1] > 1 ? ` Més repetida: <strong>${escapeHtml(getVideo(mostRepeated[0])?.title || "")}</strong> (${mostRepeated[1]} vegades).` : ""}</p>` : ""}
      ${practicedTags.length ? `<div class="history-tags" aria-label="Tipus de treball practicats">${practicedTags.map(([tag, count]) => `<span>${tagLabels[tag]} · ${count}</span>`).join("")}</div>` : ""}`;
  }

  function renderHistoryContinue() {
    const latestByVideo = new Map();
    state.sessions.forEach(session => latestByVideo.set(session.videoId, session));
    const inProgress = [...latestByVideo.values()]
      .filter(session => !session.completedAt && getVideo(session.videoId))
      .sort((a, b) => sessionActivityDate(b) - sessionActivityDate(a))
      .slice(0, 3);
    const container = $("#history-continue");
    container.hidden = !inProgress.length;
    if (!inProgress.length) { container.innerHTML = ""; return; }
    container.innerHTML = `
      <div class="section-heading compact"><div><p class="eyebrow">Reprèn</p><h2 id="history-continue-title">Continua on ho vas deixar</h2></div></div>
      <div class="continue-list">${inProgress.map(session => {
        const video = getVideo(session.videoId);
        const position = Math.max(session.lastPositionSeconds || 0, session.maxPositionSeconds || 0);
        const percent = Math.min(100, Math.round((position / video.duration) * 100));
        return `<article class="continue-card"><img ${thumbAttrs(video.id)} alt="" loading="lazy"><div><strong>${escapeHtml(video.title)}</strong><p>${formatPosition(position)} de ${formatPosition(video.duration)}</p><div class="history-progress" aria-label="${percent}% reproduït"><span style="width:${percent}%"></span></div></div><button class="button secondary" type="button" data-play="${video.id}">Continua</button></article>`;
      }).join("")}</div>`;
  }

  function renderHistoryPrograms() {
    $("#history-program-progress").innerHTML = `
      <div class="section-heading compact"><div><p class="eyebrow">Seqüències</p><h2 id="history-program-title">Progrés dels programes</h2></div></div>
      <div class="history-program-grid">${CATALOG.programs.map(program => {
        const progress = cycleProgress(program.id);
        const rounds = completedCycles(program.id);
        return `<button type="button" class="history-program-card" data-open-program="${program.id}"><span><strong>${escapeHtml(program.title)}</strong><small>${rounds ? `${rounds} ${rounds === 1 ? "volta completa" : "voltes completes"}` : progress.cycle ? "Volta en curs" : "Encara no començat"}</small></span><span class="program-percent">${progress.percent}%</span><span class="history-progress"><i style="width:${progress.percent}%"></i></span></button>`;
      }).join("")}</div>`;
  }

  function renderHistoryActivity(now = new Date()) {
    const period = $("#history-period-filter")?.value || "all";
    const level = $("#history-level-filter")?.value || "";
    const type = $("#history-type-filter")?.value || "";
    const status = $("#history-status-filter")?.value || "";
    const cutoff = period === "all" ? null : new Date(now.getTime() - Number(period) * 86400000);
    const sessions = state.sessions.filter(session => {
      const video = getVideo(session.videoId);
      if (!video) return false;
      if (cutoff && sessionActivityDate(session) < cutoff) return false;
      if (level && video.level !== level) return false;
      if (type && !video.tags.includes(type)) return false;
      if (status === "completed" && !session.completedAt) return false;
      if (status === "started" && session.completedAt) return false;
      return true;
    }).sort((a, b) => sessionActivityDate(b) - sessionActivityDate(a));

    $("#history-result-count").textContent = `${sessions.length} ${sessions.length === 1 ? "entrada" : "entrades"}`;
    if (!sessions.length) {
      $("#history-list").innerHTML = `<div class="empty-state"><strong>${state.sessions.length ? "No hi ha coincidències" : "El teu historial començarà aquí"}</strong>${state.sessions.length ? "Prova de retirar algun filtre." : "Obre una classe i reprodueix-la durant uns segons per crear la primera entrada."}</div>`;
      return;
    }

    const groups = new Map();
    sessions.forEach(session => {
      const label = historyGroupLabel(sessionActivityDate(session), now);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(session);
    });
    $("#history-list").innerHTML = [...groups.entries()].map(([label, entries]) => `
      <section class="history-group"><h3>${escapeHtml(label)}</h3><div class="history-list">${entries.map(historyItemHtml).join("")}</div></section>`).join("");
  }

  function historyGroupLabel(value, now = new Date()) {
    const date = startOfDay(value);
    if (dayKey(date) === dayKey(now)) return "Avui";
    const yesterday = addDays(startOfDay(now), -1);
    if (dayKey(date) === dayKey(yesterday)) return "Ahir";
    if (date >= startOfWeek(now)) return "Aquesta setmana";
    const label = new Intl.DateTimeFormat("ca", { month: "long", year: "numeric" }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function recentItemHtml(session) {
    const video = getVideo(session.videoId);
    if (!video) return "";
    return `<div class="recent-item"><img ${thumbAttrs(video.id)} alt="" loading="lazy"><div><strong>${escapeHtml(video.title)}</strong><p>${formatSessionDate(session)} · ${session.completedAt ? "Completada" : `Fins a ${formatPosition(session.lastPositionSeconds || 0)}`}</p></div><span class="state-icon" aria-label="${session.completedAt ? "Completada" : "En curs"}">${session.completedAt ? "✓" : "↗"}</span></div>`;
  }

  function historyItemHtml(session) {
    const video = getVideo(session.videoId);
    if (!video) return "";
    const position = Math.max(session.lastPositionSeconds || 0, session.maxPositionSeconds || 0);
    const percent = session.completedAt ? 100 : Math.min(100, Math.round((position / video.duration) * 100));
    return `<article class="history-item"><img ${thumbAttrs(video.id)} alt="" loading="lazy"><div><strong>${escapeHtml(video.title)}</strong><p>${formatSessionDate(session)} · ${session.completedAt ? `Completada${session.completionMethod === "manual" ? " manualment" : ""}` : `En curs · ${formatPosition(position)} de ${formatPosition(video.duration)}`}</p>${!session.completedAt ? `<div class="history-progress" aria-label="${percent}% reproduït"><span style="width:${percent}%"></span></div>` : ""}</div><div class="history-actions"><span class="state-icon" aria-hidden="true">${session.completedAt ? "✓" : "↗"}</span>${session.completedAt ? `<button class="undo-session" type="button" data-undo-session="${session.id}" aria-label="Desfés la finalització">Desfés</button>` : `<button class="resume-history" type="button" data-play="${video.id}">Continua</button>`}</div></article>`;
  }

  function formatSessionDate(session) {
    return new Intl.DateTimeFormat("ca", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(session.startedAt));
  }

  function renderSettings() {
    $("#pref-level").value = state.preferences.level;
    $("#pref-duration").value = String(state.preferences.duration);
    $("#pref-knee").checked = state.preferences.prioritizeKnee;
    $("#custom-video-list").innerHTML = state.customVideos.length ? `<div class="custom-list">${state.customVideos.map(video => `<div class="custom-item"><span>${escapeHtml(video.title)}</span><button type="button" data-delete-custom="${video.id}" aria-label="Elimina ${escapeHtml(video.title)}">Elimina</button></div>`).join("")}</div>` : "";
  }

  function collectionIcon(collectionId) {
    const icons = {
      knee: `<svg data-quick-icon="knee" viewBox="0 0 24 24"><path d="M8 3v4.3c0 2.2 1.1 3.8 3.1 4.7"/><circle cx="12" cy="13.2" r="2.1"/><path d="M13.6 14.6c1.7 1.2 2.7 3 2.7 5.4M10.6 15 8.8 21"/><path class="accent" d="M9.8 10.7c1.8-1.1 4.2-.8 5.7.7"/></svg>`,
      "full-body": `<svg data-quick-icon="full-body" viewBox="0 0 24 24"><circle cx="12" cy="4.2" r="2.1"/><path d="M12 6.8v7.1M5 9.2l7 2.6 7-2.6M12 13.9l-4.2 6.4M12 13.9l4.2 6.4"/><path class="accent" d="M8.5 7.8c2.2 1 4.8 1 7 0"/></svg>`,
      intermediate: `<svg data-quick-icon="intermediate" viewBox="0 0 24 24"><path d="M4 19h4v-4h4v-4h4V7h4"/><path class="accent" d="m14.5 4 5.5 3-3 5.5"/><circle cx="6" cy="11" r="2"/><path d="M7.5 12.3 10 15"/></svg>`,
      short: `<svg data-quick-icon="short" viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4.5l3 1.8M9 3h6"/><path class="accent" d="m17.8 6.3 1.5-1.5M6.2 6.3 4.7 4.8"/></svg>`,
      foundations: `<svg data-quick-icon="foundations" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><path d="M12 7.5v9M8.2 10.5c2.5 1.3 5.1 1.3 7.6 0M9 20h6M12 16.5 9 20M12 16.5l3 3.5"/><path class="accent" d="M5 8.5c-1.5 2.3-1.5 5.2 0 7.5M19 8.5c1.5 2.3 1.5 5.2 0 7.5"/></svg>`
    };
    return icons[collectionId] || icons.foundations;
  }

  function applyCollection(collectionId) {
    const collection = CATALOG.collections.find(item => item.id === collectionId);
    if (!collection) return;
    clearFilters(false);
    if (collection.filter.tag) $("#type-filter").value = collection.filter.tag;
    if (collection.filter.level) $("#level-filter").value = collection.filter.level;
    if (collection.filter.maxDuration) $("#duration-filter").value = "short";
    navigate("explora");
    renderExplore();
  }

  function navigate(route) {
    if (![$("#view-avui"), $("#view-programes"), $("#view-explora"), $("#view-historial")].some(view => view?.dataset.view === route)) route = "avui";
    currentRoute = route;
    $$(".view").forEach(view => { const active = view.dataset.view === route; view.hidden = !active; view.classList.toggle("active", active); });
    $$(".bottom-nav button").forEach(button => { if (button.dataset.route === route) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current"); });
    if (location.hash !== `#${route}`) history.replaceState(null, "", `#${route}`);
    if (route === "explora") renderExplore();
    if (route === "historial") renderHistory();
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function startSession(videoId, programId = null) {
    const video = getVideo(videoId);
    if (!video) return;
    const existing = latestSessionFor(videoId);
    currentSession = { videoId, programId, record: existing && !existing.completedAt ? existing : null, playedThisOpen: 0, lastSavedAt: 0 };
    $("#session-title").textContent = video.title;
    $("#session-meta").textContent = `${minutes(video.duration)} min · ${LEVEL_LABELS[video.level]}`;
    $("#session-context").textContent = programId ? getProgram(programId).title : "Classe lliure";
    $("#session-reason").textContent = video.tags.includes("knee-selection") ? "Selecció basada en el títol publicat pel canal. Atura't si notes dolor." : "Escolta el cos i adapta el moviment al teu ritme.";
    $("#session-thumb").src = thumb(video.id);
    $("#session-thumb").dataset.thumbId = video.id;
    $("#session-thumb").alt = `Miniatura de ${video.title}`;
    $("#open-youtube").href = `https://www.youtube.com/watch?v=${video.id}`;
    $("#session-complete").hidden = true;
    $("#next-session-button").hidden = true;
    $("#mark-complete").disabled = false;
    $("#mark-complete").textContent = "Marca com a feta";
    $("#mark-complete").classList.toggle("primary", Boolean(currentSession.record));
    $("#mark-complete").classList.toggle("secondary", !currentSession.record);
    const favorite = state.favorites.includes(videoId);
    updateSessionFavorite(favorite);
    const resumable = existing && !existing.completedAt && existing.lastPositionSeconds > 30 && video.duration - existing.lastPositionSeconds > 60;
    $("#resume-note").hidden = !resumable;
    $("#resume-note").textContent = resumable ? `Pots continuar des de ${formatPosition(existing.lastPositionSeconds)}. En carregar el vídeo reprendrem des d'aquest punt.` : "";
    currentSession.resumeAt = resumable ? existing.lastPositionSeconds : 0;
    $("#player-placeholder").hidden = false;
    $("#youtube-player").innerHTML = "";
    showDialog($("#session-dialog"));
  }

  async function loadPlayer() {
    if (!currentSession) return;
    $("#load-player").disabled = true;
    $("#load-player").querySelector("span:last-child").textContent = "Carregant…";
    try {
      await loadYouTubeApi();
      $("#player-placeholder").hidden = true;
      player = new YT.Player("youtube-player", {
        host: "https://www.youtube-nocookie.com",
        videoId: currentSession.videoId,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(currentSession.resumeAt || 0) },
        events: { onReady: event => event.target.playVideo(), onStateChange: onPlayerStateChange, onError: onPlayerError }
      });
    } catch {
      onPlayerError();
    } finally {
      $("#load-player").disabled = false;
      $("#load-player").querySelector("span:last-child").textContent = "Carrega i reprodueix";
    }
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (youtubeApiPromise) return youtubeApiPromise;
    youtubeApiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return youtubeApiPromise;
  }

  function onPlayerStateChange(event) {
    if (!window.YT) return;
    if (event.data === YT.PlayerState.PLAYING) {
      startPlayerTimer();
      if ($("#wake-lock-toggle").checked) requestWakeLock();
    } else {
      persistCurrentPosition();
      stopPlayerTimer();
      releaseWakeLock();
      if (event.data === YT.PlayerState.ENDED) completeCurrentSession("player-ended");
    }
  }

  function onPlayerError() {
    stopPlayerTimer();
    $("#player-placeholder").hidden = false;
    showToast("No s'ha pogut carregar el reproductor. Pots obrir la classe a YouTube.");
  }

  function startPlayerTimer() {
    stopPlayerTimer();
    playerTimer = setInterval(() => {
      if (!currentSession || !player?.getCurrentTime) return;
      currentSession.playedThisOpen += 5;
      if (currentSession.playedThisOpen >= 10 && !currentSession.record) currentSession.record = createSessionRecord();
      if (currentSession.record && currentSession.playedThisOpen - currentSession.lastSavedAt >= 15) {
        persistCurrentPosition();
        currentSession.lastSavedAt = currentSession.playedThisOpen;
      }
    }, 5000);
  }

  function stopPlayerTimer() {
    clearInterval(playerTimer);
    playerTimer = null;
  }

  function createSessionRecord(external = false) {
    if (!currentSession) return null;
    const record = { id: uid(), videoId: currentSession.videoId, startedAt: nowIso(), completedAt: null, completionMethod: null, lastPositionSeconds: currentSession.resumeAt || 0, maxPositionSeconds: currentSession.resumeAt || 0, cycleRefs: [], external };
    state.sessions.push(record);
    saveState();
    $("#mark-complete").classList.add("primary");
    $("#mark-complete").classList.remove("secondary");
    return record;
  }

  function persistCurrentPosition() {
    if (!currentSession?.record || !player?.getCurrentTime) return;
    try {
      const position = Math.floor(player.getCurrentTime());
      currentSession.record.lastPositionSeconds = position;
      currentSession.record.maxPositionSeconds = Math.max(currentSession.record.maxPositionSeconds || 0, position);
      saveState();
    } catch { /* The iframe can disappear while closing. */ }
  }

  async function completeCurrentSession(method) {
    if (!currentSession) return;
    if (method === "manual") {
      const confirmed = await askConfirm("La classe quedarà registrada com a completada. Ho podràs desfer des de l'historial.", "Marca la classe com a feta", "Marca-la");
      if (!confirmed || !currentSession) return;
    }
    if (!currentSession.record) currentSession.record = createSessionRecord();
    if (currentSession.record.completedAt) return;
    persistCurrentPosition();
    currentSession.record.completedAt = nowIso();
    currentSession.record.completionMethod = method;
    currentSession.record.cycleRefs = applyCompletionToCycles(currentSession.videoId, currentSession.programId);
    saveState();
    $("#mark-complete").disabled = true;
    $("#mark-complete").textContent = "Completada";
    $("#session-complete").hidden = false;
    const nextId = currentSession.programId ? nextInProgram(currentSession.programId) : null;
    if (nextId) {
      const nextVideo = getVideo(nextId);
      $("#next-session-copy").textContent = `La següent és “${nextVideo.title}”.`;
      $("#next-session-button").hidden = false;
      $("#next-session-button").dataset.nextVideo = nextId;
      $("#next-session-button").dataset.program = currentSession.programId;
    } else {
      $("#next-session-copy").textContent = currentSession.programId ? "Has completat aquesta volta del programa." : "La trobaràs desada al teu historial.";
    }
    announce("Classe completada");
    showToast("Classe completada", "Desfés", () => undoSession(currentSession?.record?.id));
    renderAll();
  }

  function applyCompletionToCycles(videoId, contextProgramId) {
    const refs = [];
    CATALOG.programs.filter(program => program.items.includes(videoId)).forEach(program => {
      let cycle = getActiveCycle(program.id);
      if (!cycle && program.id === contextProgramId) cycle = ensureActiveCycle(program.id);
      if (!cycle || cycle.completedAt) return;
      if (!cycle.completedVideoIds.includes(videoId)) cycle.completedVideoIds.push(videoId);
      refs.push({ programId: program.id, cycleId: cycle.id });
      if (program.items.every(id => cycle.completedVideoIds.includes(id))) cycle.completedAt = nowIso();
    });
    return refs;
  }

  function undoSession(sessionId) {
    const session = state.sessions.find(item => item.id === sessionId);
    if (!session?.completedAt) return;
    (session.cycleRefs || []).forEach(ref => {
      const cycle = getCycles(ref.programId).find(item => item.id === ref.cycleId);
      if (!cycle) return;
      const otherCompletion = state.sessions.some(other => other.id !== session.id && other.completedAt && other.videoId === session.videoId && (other.cycleRefs || []).some(item => item.cycleId === ref.cycleId));
      if (!otherCompletion) cycle.completedVideoIds = cycle.completedVideoIds.filter(id => id !== session.videoId);
      cycle.completedAt = null;
    });
    session.completedAt = null;
    session.completionMethod = null;
    saveState();
    renderAll();
    showToast("La finalització s'ha desfet");
  }

  async function closeSession() {
    if (!currentSession) { $("#session-dialog").close(); return; }
    let isPlaying = false;
    try { isPlaying = player?.getPlayerState?.() === YT.PlayerState.PLAYING; } catch { /* noop */ }
    if (isPlaying) {
      const confirmed = await askConfirm("El punt on ho deixes quedarà desat.", "Vols sortir de la sessió?", "Surt");
      if (!confirmed) return;
    }
    persistCurrentPosition();
    stopPlayerTimer();
    releaseWakeLock();
    try { player?.destroy?.(); } catch { /* noop */ }
    player = null;
    currentSession = null;
    $("#session-dialog").close();
    renderAll();
  }

  function toggleFavorite(videoId) {
    const active = state.favorites.includes(videoId);
    state.favorites = active ? state.favorites.filter(id => id !== videoId) : [...state.favorites, videoId];
    saveState();
    if (currentSession?.videoId === videoId) updateSessionFavorite(!active);
    renderAll();
    showToast(active ? "S'ha retirat de preferides" : "S'ha afegit a preferides");
  }

  function updateSessionFavorite(active) {
    const button = $("#session-favorite");
    button.textContent = active ? "♥" : "♡";
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "Retira de preferides" : "Afegeix a preferides");
  }

  async function requestWakeLock() {
    if (!navigator.wakeLock || wakeLock) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); }
    catch { $("#wake-lock-toggle").checked = false; showToast("Aquest dispositiu no permet mantenir la pantalla encesa."); }
  }

  async function releaseWakeLock() {
    if (!wakeLock) return;
    try { await wakeLock.release(); } catch { /* noop */ }
    wakeLock = null;
  }

  function showDialog(dialog) {
    lastFocusedElement = document.activeElement;
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog(dialog) {
    dialog.close();
    lastFocusedElement?.focus?.();
  }

  function askConfirm(message, title = "Confirmació", acceptText = "Confirma") {
    const dialog = $("#confirm-dialog");
    $("#confirm-title").textContent = title;
    $("#confirm-message").textContent = message;
    $("#confirm-accept").textContent = acceptText;
    dialog.returnValue = "";
    showDialog(dialog);
    return new Promise(resolve => dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true }));
  }

  function showToast(message, actionLabel = "", action = null) {
    clearTimeout(toastTimer);
    const toast = $("#toast");
    $("#toast-message").textContent = message;
    const button = $("#toast-action");
    button.hidden = !actionLabel;
    button.textContent = actionLabel;
    button.onclick = action ? () => { action(); toast.hidden = true; } : null;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, actionLabel ? 7000 : 3800);
  }

  function announce(message) {
    $("#live-region").textContent = "";
    setTimeout(() => { $("#live-region").textContent = message; }, 30);
  }

  function clearFilters(render = true) {
    $("#search-input").value = "";
    $("#level-filter").value = "";
    $("#duration-filter").value = "";
    $("#type-filter").value = "";
    $("#status-filter").value = "";
    if (render) renderExplore();
  }

  function updateInstallUi() {
    const installed = isStandalone();
    const dismissedRecently = state.installDismissedAt && Date.now() - new Date(state.installDismissedAt).getTime() < 7 * 86400000;
    const canPrompt = Boolean(deferredInstallPrompt);
    $("#install-shortcut").hidden = installed || (!canPrompt && !isIos());
    $("#install-button").hidden = installed;
    $("#install-help").textContent = installed ? "L'aplicació ja està instal·lada en aquest dispositiu." : isIos() ? "A Safari, toca Compartir i després “Afegir a la pantalla d'inici”." : "Instal·la l'aplicació per obrir-la ràpidament des de la pantalla d'inici.";
    if (installed || dismissedRecently || (!canPrompt && !isIos())) { $("#install-card-slot").innerHTML = ""; return; }
    $("#install-card-slot").innerHTML = `<aside class="install-card"><span class="install-icon" aria-hidden="true">↓</span><strong>Porta Pilates a mà al teu inici</strong><button class="button primary install-card-button" type="button">${isIos() && !canPrompt ? "Com instal·lar" : "Instal·la"}</button><button class="dismiss-install" type="button" aria-label="Ara no">×</button></aside>`;
  }

  async function promptInstall() {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (result.outcome === "accepted") showToast("Aplicació instal·lada");
      updateInstallUi();
    } else if (isIos()) {
      showToast("A Safari: Compartir → Afegir a la pantalla d'inici");
    }
  }

  function addCustomVideo(form) {
    const url = $("#custom-url").value.trim();
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
    if (!match) { showToast("L'enllaç de YouTube no és vàlid."); return; }
    const id = match[1];
    if (getVideo(id)) { showToast("Aquesta classe ja és al catàleg."); return; }
    state.customVideos.push({ id, title: $("#custom-title").value.trim(), originalTitle: $("#custom-title").value.trim(), duration: Number($("#custom-duration").value) * 60, level: $("#custom-level").value, tags: ["custom", "no-equipment"], custom: true });
    saveState();
    form.reset();
    $("#custom-duration").value = 30;
    renderAll();
    showToast("Classe personal afegida");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: "Pilates a mà", exportedAt: nowIso(), data: state }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pilates-a-ma-copia-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("Còpia de seguretat exportada");
  }

  async function importData(file) {
    try {
      const parsed = JSON.parse(await file.text());
      const imported = parsed.data;
      if (!imported || imported.schemaVersion !== SCHEMA_VERSION || !Array.isArray(imported.sessions)) throw new Error("invalid");
      const choice = await askImportChoice(imported.sessions.length);
      if (choice === "cancel") return;
      state = choice === "merge" ? mergeImportedState(imported) : { ...defaultState(), ...imported, preferences: { ...defaultState().preferences, ...imported.preferences } };
      saveState();
      renderAll();
      showToast(choice === "merge" ? "Còpia combinada correctament" : "Còpia restaurada correctament");
    } catch { showToast("No s'ha pogut llegir aquesta còpia."); }
  }

  function askImportChoice(sessionCount) {
    const dialog = $("#import-choice-dialog");
    $("#import-choice-message").textContent = `La còpia conté ${sessionCount} sessions. Pots combinar-la amb les dades actuals o substituir-les completament.`;
    dialog.returnValue = "cancel";
    showDialog(dialog);
    return new Promise(resolve => dialog.addEventListener("close", () => resolve(dialog.returnValue || "cancel"), { once: true }));
  }

  function mergeImportedState(imported) {
    const sessionMap = new Map([...state.sessions, ...(imported.sessions || [])].map(session => [session.id, session]));
    const customMap = new Map([...state.customVideos, ...(imported.customVideos || [])].map(video => [video.id, video]));
    const mergedCycles = { ...state.programCycles };
    Object.entries(imported.programCycles || {}).forEach(([programId, cycles]) => {
      const cycleMap = new Map([...(mergedCycles[programId] || []), ...cycles].map(cycle => [cycle.id, cycle]));
      mergedCycles[programId] = [...cycleMap.values()].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
    });
    return {
      ...state,
      schemaVersion: SCHEMA_VERSION,
      favorites: [...new Set([...state.favorites, ...(imported.favorites || [])])],
      sessions: [...sessionMap.values()].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt)),
      customVideos: [...customMap.values()],
      programCycles: mergedCycles
    };
  }

  function bindEvents() {
    document.addEventListener("error", event => {
      if (event.target instanceof HTMLImageElement && event.target.dataset.thumbId) {
        if (!event.target.dataset.fallbackApplied) {
          event.target.dataset.fallbackApplied = "true";
          event.target.src = fallbackThumb(event.target.dataset.thumbId);
        } else if (!event.target.dataset.localFallback) {
          event.target.dataset.localFallback = "true";
          event.target.classList.add("fallback-thumb");
          event.target.src = "favicon.svg";
        }
      }
    }, true);
    document.addEventListener("click", event => {
      const route = event.target.closest("[data-route]")?.dataset.route || event.target.closest("[data-go]")?.dataset.go;
      if (route) { navigate(route); return; }
      const startProgram = event.target.closest("[data-start-program]");
      if (startProgram) {
        const programId = startProgram.dataset.startProgram;
        ensureActiveCycle(programId);
        startSession(nextInProgram(programId) || getProgram(programId).items[0], programId);
        return;
      }
      const play = event.target.closest("[data-play]");
      if (play) { const openDialog = play.closest("dialog"); if (openDialog?.id === "program-dialog") openDialog.close(); startSession(play.dataset.play, play.dataset.program || null); return; }
      const favorite = event.target.closest("[data-favorite]");
      if (favorite) { toggleFavorite(favorite.dataset.favorite); return; }
      const collection = event.target.closest("[data-collection]");
      if (collection) { applyCollection(collection.dataset.collection); return; }
      const program = event.target.closest("[data-open-program]");
      if (program) { openProgram(program.dataset.openProgram); return; }
      const newCycle = event.target.closest("[data-new-cycle]");
      if (newCycle) { ensureActiveCycle(newCycle.dataset.newCycle); closeDialog($("#program-dialog")); openProgram(newCycle.dataset.newCycle); renderAll(); return; }
      const undo = event.target.closest("[data-undo-session]");
      if (undo) { undoSession(undo.dataset.undoSession); return; }
      const del = event.target.closest("[data-delete-custom]");
      if (del) { state.customVideos = state.customVideos.filter(video => video.id !== del.dataset.deleteCustom); saveState(); renderAll(); showToast("Classe personal eliminada"); return; }
      if (event.target.closest(".why-button")) { const button = event.target.closest(".why-button"); const panel = button.closest(".hero-content").querySelector(".recommendation-reasons"); panel.hidden = !panel.hidden; button.setAttribute("aria-expanded", String(!panel.hidden)); return; }
      if (event.target.closest(".close-dialog")) { closeDialog(event.target.closest("dialog")); return; }
      if (event.target.closest(".install-card-button") || event.target.closest("#install-button") || event.target.closest("#install-shortcut")) { promptInstall(); return; }
      if (event.target.closest(".dismiss-install")) { state.installDismissedAt = nowIso(); saveState(); updateInstallUi(); }
    });

    $$("#filters input, #filters select").forEach(control => control.addEventListener("input", renderExplore));
    $("#clear-filters").addEventListener("click", () => clearFilters());
    $$("#history-filters select").forEach(control => control.addEventListener("input", () => renderHistoryActivity()));
    $("#clear-history-filters").addEventListener("click", () => { $("#history-filters").reset(); renderHistoryActivity(); });
    $("#settings-button").addEventListener("click", () => showDialog($("#settings-dialog")));
    $("#load-player").addEventListener("click", loadPlayer);
    $("#close-session").addEventListener("click", closeSession);
    $("#session-dialog").addEventListener("cancel", event => { event.preventDefault(); closeSession(); });
    $("#mark-complete").addEventListener("click", () => completeCurrentSession("manual"));
    $("#session-favorite").addEventListener("click", () => currentSession && toggleFavorite(currentSession.videoId));
    $("#open-youtube").addEventListener("click", () => { if (currentSession && !currentSession.record) currentSession.record = createSessionRecord(true); });
    $("#next-session-button").addEventListener("click", event => { const { nextVideo, program } = event.currentTarget.dataset; closeSession().then(() => startSession(nextVideo, program)); });
    $("#wake-lock-toggle").addEventListener("change", event => { if (!event.target.checked) releaseWakeLock(); else { try { if (player?.getPlayerState?.() === YT.PlayerState.PLAYING) requestWakeLock(); } catch { /* noop */ } } });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && $("#wake-lock-toggle").checked) { try { if (player?.getPlayerState?.() === YT.PlayerState.PLAYING) requestWakeLock(); } catch { /* noop */ } } });
    ["#pref-level", "#pref-duration", "#pref-knee"].forEach(selector => $(selector).addEventListener("change", () => { state.preferences = { level: $("#pref-level").value, duration: Number($("#pref-duration").value), prioritizeKnee: $("#pref-knee").checked }; saveState(); renderToday(); }));
    $("#custom-video-form").addEventListener("submit", event => { event.preventDefault(); addCustomVideo(event.currentTarget); });
    $("#export-data").addEventListener("click", exportData);
    $("#import-data").addEventListener("change", event => { const file = event.target.files[0]; if (file) importData(file); event.target.value = ""; });
    $("#reset-data").addEventListener("click", async () => { if (await askConfirm("S'esborraran l'historial, el progrés, els preferits i les classes personals d'aquest dispositiu.", "Esborra les meves dades", "Esborra-ho")) { state = defaultState(); saveState(); renderAll(); closeDialog($("#settings-dialog")); showToast("Les dades s'han esborrat"); } });
    window.addEventListener("hashchange", () => navigate(location.hash.slice(1) || "avui"));
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferredInstallPrompt = event; updateInstallUi(); });
    window.addEventListener("appinstalled", () => { deferredInstallPrompt = null; updateInstallUi(); });
  }

  function updateConnection() {
    $("#connection-banner").hidden = navigator.onLine;
    if (!navigator.onLine) announce("Estàs sense connexió. Els vídeos necessiten Internet.");
  }

  function validateCatalog() {
    const ids = CATALOG.videos.map(video => video.id);
    const errors = [];
    if (new Set(ids).size !== ids.length) errors.push("Hi ha vídeos duplicats.");
    CATALOG.programs.forEach(program => {
      program.items.forEach(id => { if (!ids.includes(id)) errors.push(`${program.id} referencia ${id}, que no existeix.`); });
      if (new Set(program.items).size !== program.items.length) errors.push(`${program.id} conté vídeos repetits.`);
    });
    if (errors.length) console.error("Errors de catàleg", errors);
    return errors;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("./sw.js").then(registration => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) showToast("Hi ha una versió nova. Es carregarà en tornar a obrir l'aplicació."); });
      });
    }).catch(error => console.warn("No s'ha pogut registrar el service worker", error));
  }

  validateCatalog();
  bindEvents();
  updateConnection();
  renderAll();
  navigate(location.hash.slice(1) || "avui");
  registerServiceWorker();
})();
