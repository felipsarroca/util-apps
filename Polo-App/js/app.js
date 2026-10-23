const COURSES = ['1r ESO', '2n ESO', '3r ESO', '4t ESO'];
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbx38uh7P5qqE6HgRWGNKI29KeZbGRCMlO2zz4Eu3VRi246c3nutH_M01ZxKDWvy41o/exec';

const HOLD_TO_UNDO_MS = 3000;
const STUDENTS_STALE_MS = 20000;
const DASHBOARD_STALE_MS = 60000;
const REPEAT_THRESHOLD = 3;
const HIGH_REPEAT_THRESHOLD = 5;
const STATUS_HIDE_MS = 3500;

const STORAGE_KEYS = {
  students: 'polo-students-v2',
  dashboard: 'polo-dashboard-v1',
  prefs: 'polo-consultes-v1'
};

const PERIOD_LABELS = {
  week: 'Aquesta setmana',
  month: 'Aquest mes',
  term: 'Aquest trimestre',
  year: 'Aquest curs',
  all: 'Tot l\'historial'
};

const WEEKDAYS = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres'];
const WEEKDAY_ABBR = ['dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.', 'dg.'];

const registerScreen = document.getElementById('register-screen');
const consultationsScreen = document.getElementById('consultations-screen');
const studentsPanel = document.getElementById('students-panel');
const studentsTitle = document.getElementById('students-title');
const studentsList = document.getElementById('students-list');
const statusBox = document.getElementById('status-box');
const courseButtons = document.querySelectorAll('.course-button');
const openConsultationsButton = document.getElementById('open-consultations');
const backToRegisterButton = document.getElementById('back-to-register');
const periodChips = document.querySelectorAll('[data-period]');
const courseChips = document.querySelectorAll('[data-course-filter]');
const viewTabs = document.querySelectorAll('[data-view]');
const reportContent = document.getElementById('report-content');
const reportMeta = document.getElementById('report-meta');
const refreshReportButton = document.getElementById('refresh-report');
const shareReportButton = document.getElementById('share-report');
const installBanner = document.getElementById('install-banner');
const installTitle = document.getElementById('install-title');
const installText = document.getElementById('install-text');
const installActionButton = document.getElementById('install-action');
const installDismissButton = document.getElementById('install-dismiss');

const registerState = {
  today: '',
  byCourse: {},
  loadedAt: 0,
  currentCourse: '',
  pending: new Map(),
  loadingPromise: null
};

const dashboardState = {
  data: null,
  fetchedAt: 0,
  dirty: false,
  loading: false,
  prefs: readStorage(STORAGE_KEYS.prefs) || { period: 'year', course: '', view: 'summary' },
  expanded: new Set(),
  search: ''
};

const holdState = {
  timer: null,
  button: null,
  startX: 0,
  startY: 0,
  suppressClick: false
};

let deferredInstallPrompt = null;
let statusTimer = null;

courseButtons.forEach((button) => {
  button.addEventListener('click', () => {
    openCourse(button.dataset.course);
  });
});

openConsultationsButton.addEventListener('click', () => {
  registerScreen.classList.add('hidden');
  consultationsScreen.classList.remove('hidden');
  hideStatus();
  window.scrollTo(0, 0);
  openConsultations();
});

backToRegisterButton.addEventListener('click', () => {
  consultationsScreen.classList.add('hidden');
  registerScreen.classList.remove('hidden');
  hideStatus();
});

periodChips.forEach((chip) => {
  chip.addEventListener('click', () => updatePrefs({ period: chip.dataset.period }));
});

courseChips.forEach((chip) => {
  chip.addEventListener('click', () => updatePrefs({ course: chip.dataset.courseFilter }));
});

viewTabs.forEach((tab) => {
  tab.addEventListener('click', () => updatePrefs({ view: tab.dataset.view }));
});

refreshReportButton.addEventListener('click', () => loadDashboard(true));
shareReportButton.addEventListener('click', shareCurrentReport);

reportContent.addEventListener('click', handleReportClick);
reportContent.addEventListener('input', (event) => {
  if (event.target.id === 'ranking-search') {
    dashboardState.search = event.target.value;
    renderRankingList();
  }
});

studentsList.addEventListener('click', handleStudentClick);
studentsList.addEventListener('pointerdown', startHold);
studentsList.addEventListener('pointermove', moveHold);
['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
  studentsList.addEventListener(type, cancelHold);
});
studentsList.addEventListener('contextmenu', (event) => {
  if (event.target.closest('.student-action')) {
    event.preventDefault();
  }
});

installDismissButton.addEventListener('click', () => {
  hideInstallBanner();
});

installActionButton.addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      hideInstallBanner();
      showStatus('L\'app s\'està instal·lant al dispositiu.', 'success');
    }

    deferredInstallPrompt = null;
    return;
  }

  if (isIosDevice() && !isStandaloneMode()) {
    showStatus('A Safari toca Compartir i després Afegeix a la pantalla d\'inici.', 'warning');
  }
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  showInstallBanner({
    title: 'Instal·la aquesta app al mòbil',
    text: 'Prem el botó i el navegador obrirà la instal·lació.'
  });
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallBanner();
  showStatus('L\'app ja ha quedat instal·lada.', 'success');
});

registerServiceWorker();
setupInstallExperience();
restoreStudentsCache();
loadAllStudents();

/* ---------- Registre ---------- */

function restoreStudentsCache() {
  const cached = readStorage(STORAGE_KEYS.students);

  if (!cached || !cached.byCourse) {
    return;
  }

  registerState.today = cached.today || '';
  registerState.byCourse = cached.byCourse;
}

// Carrega tots els cursos en una sola crida i, de passada, desperta el backend.
function loadAllStudents() {
  if (registerState.loadingPromise) {
    return registerState.loadingPromise;
  }

  registerState.loadingPromise = fetchApi('getStudents', {}, 'No s\'ha pogut carregar l\'alumnat.')
    .then((result) => {
      const byCourse = {};
      COURSES.forEach((course) => {
        byCourse[course] = [];
      });

      (result.students || []).forEach((student) => {
        if (byCourse[student.curs]) {
          byCourse[student.curs].push(student);
        }
      });

      registerState.byCourse = byCourse;
      registerState.today = result.today || '';
      registerState.loadedAt = Date.now();
      writeStorage(STORAGE_KEYS.students, { today: registerState.today, byCourse });

      // No es redibuixa la llista mentre es manté premut un botó.
      if (registerState.currentCourse && !holdState.button) {
        renderStudents(registerState.currentCourse);
      }
    })
    .finally(() => {
      registerState.loadingPromise = null;
    });

  return registerState.loadingPromise;
}

async function openCourse(course) {
  if (!COURSES.includes(course)) {
    showStatus('Curs no vàlid.', 'error');
    return;
  }

  registerState.currentCourse = course;
  setActiveCourse(course);
  studentsPanel.classList.remove('hidden');
  hideStatus();

  const hasData = Array.isArray(registerState.byCourse[course]);

  if (hasData) {
    renderStudents(course);
  } else {
    studentsTitle.textContent = course;
    studentsList.innerHTML = `
      <div class="student-card loading-card">
        <p class="student-name">Carregant alumnat...</p>
      </div>
    `;
  }

  if (!hasData || Date.now() - registerState.loadedAt > STUDENTS_STALE_MS) {
    try {
      await loadAllStudents();
    } catch (error) {
      if (!hasData) {
        studentsList.innerHTML = '';
      }
      showStatus(error.message || 'No s\'ha pogut carregar l\'alumnat.', 'error');
    }
  }
}

function renderStudents(course) {
  const students = registerState.byCourse[course] || [];

  // Les accions encara en curs mantenen l'estat que ha vist el professor.
  registerState.pending.forEach((pendingState, studentId) => {
    const student = students.find((item) => item.id_alumne === studentId);
    if (student) {
      student.registeredToday = pendingState === 'register';
    }
  });

  updateStudentsTitle(course);

  if (students.length === 0) {
    studentsList.innerHTML = `
      <div class="student-card">
        <p class="student-name">No hi ha alumnat per a aquest curs.</p>
      </div>
    `;
    return;
  }

  studentsList.innerHTML = students.map((student) => `
    <div class="student-card" data-student-card="${escapeHtml(student.id_alumne)}">
      <div class="student-row">
        <button class="student-action" type="button" data-student-id="${escapeHtml(student.id_alumne)}">
          <span class="student-action-icon" aria-hidden="true"></span>
          <svg class="hold-ring" viewBox="0 0 48 48" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="13" pathLength="100"></rect></svg>
        </button>
        <div class="student-main">
          <p class="student-name">${escapeHtml(student.nom_complet)}</p>
          <p class="student-count"></p>
        </div>
      </div>
    </div>
  `).join('');

  students.forEach((student) => {
    const card = studentsList.querySelector(`[data-student-card="${cssEscape(student.id_alumne)}"]`);
    applyStudentState(card, student, registerState.pending.has(student.id_alumne));
  });
}

function applyStudentState(card, student, syncing) {
  if (!card) {
    return;
  }

  const button = card.querySelector('.student-action');
  const icon = card.querySelector('.student-action-icon');
  const countLine = card.querySelector('.student-count');
  const registered = Boolean(student.registeredToday);
  const yearCount = Number(student.yearCount) || 0;

  card.classList.toggle('is-registered', registered);
  card.classList.toggle('is-pending', !registered);
  button.classList.toggle('is-done', registered);
  button.classList.toggle('is-ready', !registered);
  button.classList.toggle('is-syncing', Boolean(syncing));
  button.setAttribute('aria-label', registered
    ? `${student.nom_complet}: marcat sense polo. Mantén premut 3 segons per desfer-ho.`
    : `Marcar ${student.nom_complet} sense polo`);
  icon.innerHTML = registered ? '&#10005;' : '&#10003;';

  countLine.textContent = yearCount > 0 ? `${yearCount} ${yearCount === 1 ? 'vegada' : 'vegades'} aquest curs` : '';
  countLine.classList.toggle('is-repeat', yearCount >= REPEAT_THRESHOLD);
}

function updateStudentsTitle(course) {
  const students = registerState.byCourse[course] || [];
  const marked = students.filter((student) => student.registeredToday).length;
  studentsTitle.innerHTML = `${escapeHtml(course)} <span class="students-title__count">· ${marked} ${marked === 1 ? 'marcat' : 'marcats'} avui</span>`;
}

function findStudent(studentId) {
  const students = registerState.byCourse[registerState.currentCourse] || [];
  return students.find((student) => student.id_alumne === studentId) || null;
}

function handleStudentClick(event) {
  const button = event.target.closest('.student-action');

  if (!button) {
    return;
  }

  if (holdState.suppressClick) {
    holdState.suppressClick = false;
    return;
  }

  const studentId = button.dataset.studentId;
  const student = findStudent(studentId);

  if (!student || registerState.pending.has(studentId)) {
    return;
  }

  if (student.registeredToday) {
    showStatus('Per desfer-ho, mantén premut el botó vermell 3 segons.', 'warning');
    return;
  }

  changeRegistration(student, true);
}

async function changeRegistration(student, register) {
  const studentId = student.id_alumne;
  const course = registerState.currentCourse;
  const getCard = () => studentsList.querySelector(`[data-student-card="${cssEscape(studentId)}"]`);

  registerState.pending.set(studentId, register ? 'register' : 'unregister');
  student.registeredToday = register;
  student.yearCount = Math.max(0, (Number(student.yearCount) || 0) + (register ? 1 : -1));
  applyStudentState(getCard(), student, true);
  updateStudentsTitle(course);

  try {
    const result = await fetchApi(
      register ? 'registerStudent' : 'unregisterStudent',
      { studentId },
      register ? 'No s\'ha pogut registrar l\'alumne.' : 'No s\'ha pogut desfer el registre.'
    );

    dashboardState.dirty = true;

    if (result.status === 'registered') {
      showStatus(`${student.nom_complet}: registrat sense polo.`, 'success');
    } else if (result.status === 'duplicate') {
      showStatus(`${student.nom_complet} ja estava registrat avui.`, 'warning');
    } else if (result.status === 'unregistered') {
      showStatus(`S'ha desfet el registre de ${student.nom_complet}.`, 'success');
    } else if (result.status === 'not_found') {
      showStatus(`${student.nom_complet} no tenia cap registre avui.`, 'warning');
    } else {
      throw new Error(result.message || 'Resposta inesperada del backend.');
    }
  } catch (error) {
    student.registeredToday = !register;
    student.yearCount = Math.max(0, (Number(student.yearCount) || 0) + (register ? -1 : 1));
    showStatus(error.message || 'No s\'ha pogut desar el canvi.', 'error');
  } finally {
    registerState.pending.delete(studentId);

    // Si mentrestant s'ha refrescat la llista, l'objecte nou ha de reflectir el resultat.
    const current = (registerState.byCourse[course] || []).find((item) => item.id_alumne === studentId);
    if (current && current !== student) {
      current.registeredToday = student.registeredToday;
      student = current;
    }
    writeStorage(STORAGE_KEYS.students, { today: registerState.today, byCourse: registerState.byCourse });

    if (registerState.currentCourse === course) {
      applyStudentState(getCard(), student, false);
      updateStudentsTitle(course);
    }
  }
}

/* ---------- Pulsació llarga per desfer ---------- */

function startHold(event) {
  const button = event.target.closest('.student-action.is-done');
  holdState.suppressClick = false;

  if (!button || button.classList.contains('is-syncing') || (event.pointerType === 'mouse' && event.button !== 0)) {
    return;
  }

  cancelHold();
  holdState.button = button;
  holdState.startX = event.clientX;
  holdState.startY = event.clientY;
  button.classList.add('is-holding');

  holdState.timer = window.setTimeout(() => {
    const student = findStudent(button.dataset.studentId);
    button.classList.remove('is-holding');
    holdState.timer = null;
    holdState.button = null;
    holdState.suppressClick = true;

    if (navigator.vibrate) {
      navigator.vibrate(40);
    }

    if (student && student.registeredToday && !registerState.pending.has(student.id_alumne)) {
      changeRegistration(student, false);
    }
  }, HOLD_TO_UNDO_MS);
}

function moveHold(event) {
  if (!holdState.button) {
    return;
  }

  if (Math.abs(event.clientX - holdState.startX) > 12 || Math.abs(event.clientY - holdState.startY) > 12) {
    cancelHold();
  }
}

function cancelHold() {
  if (holdState.timer) {
    window.clearTimeout(holdState.timer);
  }

  if (holdState.button) {
    holdState.button.classList.remove('is-holding');
  }

  holdState.timer = null;
  holdState.button = null;
}

/* ---------- Consultes ---------- */

function openConsultations() {
  restoreDashboardCache();
  syncFilterControls();

  if (dashboardState.data) {
    renderDashboard();
  }

  const isStale = Date.now() - dashboardState.fetchedAt > DASHBOARD_STALE_MS;

  if (!dashboardState.data || dashboardState.dirty || isStale) {
    loadDashboard(false);
  }
}

function restoreDashboardCache() {
  if (dashboardState.data) {
    return;
  }

  const cached = readStorage(STORAGE_KEYS.dashboard);

  if (cached && cached.data) {
    dashboardState.data = cached.data;
    dashboardState.fetchedAt = cached.fetchedAt || 0;
  }
}

async function loadDashboard(force) {
  if (dashboardState.loading) {
    return;
  }

  dashboardState.loading = true;
  refreshReportButton.disabled = true;
  refreshReportButton.textContent = 'Actualitzant...';

  if (!dashboardState.data) {
    reportContent.innerHTML = '<p class="report-note">Carregant dades...</p>';
  }

  try {
    const data = await fetchApi('getDashboard', {}, 'No s\'han pogut carregar les dades.');
    dashboardState.data = data;
    dashboardState.fetchedAt = Date.now();
    dashboardState.dirty = false;
    writeStorage(STORAGE_KEYS.dashboard, { data, fetchedAt: dashboardState.fetchedAt });
    renderDashboard();

    if (force) {
      showStatus('Dades actualitzades.', 'success');
    }
  } catch (error) {
    if (!dashboardState.data) {
      reportContent.innerHTML = emptyReportHtml(error.message || 'No s\'han pogut carregar les dades.');
    }
    showStatus(error.message || 'No s\'han pogut carregar les dades.', 'error');
  } finally {
    dashboardState.loading = false;
    refreshReportButton.disabled = false;
    refreshReportButton.textContent = 'Actualitza';
    updateReportMeta();
  }
}

function updatePrefs(changes) {
  dashboardState.prefs = { ...dashboardState.prefs, ...changes };
  writeStorage(STORAGE_KEYS.prefs, dashboardState.prefs);
  syncFilterControls();

  if (dashboardState.data) {
    renderDashboard();
  }
}

function syncFilterControls() {
  const { period, course, view } = dashboardState.prefs;
  periodChips.forEach((chip) => setPressed(chip, chip.dataset.period === period));
  courseChips.forEach((chip) => setPressed(chip, chip.dataset.courseFilter === course));
  viewTabs.forEach((tab) => setPressed(tab, tab.dataset.view === view));
}

function setPressed(element, isActive) {
  element.classList.toggle('is-active', isActive);
  element.setAttribute('aria-pressed', String(isActive));
}

function updateReportMeta() {
  if (!dashboardState.fetchedAt) {
    reportMeta.textContent = '';
    return;
  }

  const time = new Date(dashboardState.fetchedAt).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
  reportMeta.textContent = `Dades de les ${time}`;
}

// Converteix les dades compactes del backend en estadístiques del període i grup triats.
function buildStats() {
  const data = dashboardState.data;
  const { period, course } = dashboardState.prefs;
  const today = data.today;
  const range = getPeriodRange(period, today);
  const studentMap = new Map();

  (data.students || []).forEach(([id, nom, curs, actiu]) => {
    studentMap.set(id, { id, nom, curs, actiu: Boolean(actiu) });
  });

  const population = [...studentMap.values()].filter((student) => student.actiu && (!course || student.curs === course));
  const inCourse = (row) => !course || row[2] === course;
  const allRows = (data.registers || []).filter(inCourse);
  const rows = allRows.filter((row) => row[0] >= range.from && row[0] <= today);
  const byStudent = new Map();

  rows.forEach(([date, id, curs]) => {
    if (!byStudent.has(id)) {
      const info = studentMap.get(id) || { nom: id, curs };
      byStudent.set(id, { id, nom: info.nom, curs: info.curs || curs, total: 0, dates: [] });
    }

    const entry = byStudent.get(id);
    entry.total += 1;
    entry.dates.push(date);
  });

  const ranking = [...byStudent.values()]
    .map((entry) => ({ ...entry, dates: entry.dates.sort().reverse(), lastDate: entry.dates[0] }))
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, 'ca'));

  // Les posicions empatades comparteixen número (1, 1, 3...).
  ranking.forEach((entry, index) => {
    entry.rank = index > 0 && ranking[index - 1].total === entry.total ? ranking[index - 1].rank : index + 1;
  });

  return {
    today,
    range,
    course,
    period,
    rows,
    allRows,
    ranking,
    studentMap,
    population,
    todayRows: allRows.filter((row) => row[0] === today)
  };
}

function renderDashboard() {
  const stats = buildStats();
  const view = dashboardState.prefs.view;

  if (view === 'ranking') {
    renderRankingView(stats);
  } else if (view === 'courses') {
    renderCoursesView(stats);
  } else if (view === 'days') {
    renderDaysView(stats);
  } else {
    renderSummaryView(stats);
  }

  updateReportMeta();
}

function contextLabel(stats) {
  return `${stats.course || 'Tota l\'ESO'} · ${PERIOD_LABELS[stats.period]}`;
}

function renderSummaryView(stats) {
  const affected = stats.ranking.length;
  const populationSize = stats.population.length;
  const percentage = populationSize ? Math.round((affected / populationSize) * 100) : 0;
  const repeaters = stats.ranking.filter((entry) => entry.total >= REPEAT_THRESHOLD).length;
  const top = stats.ranking.filter((entry) => entry.rank <= 5).slice(0, 10);
  const todayNames = stats.todayRows
    .map(([, id, curs]) => ({ nom: (stats.studentMap.get(id) || { nom: id }).nom, curs }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));

  reportContent.innerHTML = `
    <p class="report-context">${escapeHtml(contextLabel(stats))}</p>
    <div class="kpi-grid">
      ${kpiHtml(stats.rows.length, 'registres', '')}
      ${kpiHtml(affected, affected === 1 ? 'alumne diferent' : 'alumnes diferents', populationSize ? `${percentage}% de ${populationSize}` : '')}
      ${kpiHtml(repeaters, 'reincidents', `${REPEAT_THRESHOLD} o més vegades`, repeaters > 0 ? 'is-warning' : '')}
      ${kpiHtml(todayNames.length, 'avui', formatDisplayDate(stats.today))}
    </div>

    <h3 class="report-heading">Avui</h3>
    ${todayNames.length
      ? `<ul class="name-list">${todayNames.map((item) => `<li><span>${escapeHtml(item.nom)}</span><span class="muted">${escapeHtml(stats.course ? '' : item.curs)}</span></li>`).join('')}</ul>`
      : '<p class="report-note">Avui encara no hi ha cap registre.</p>'}

    <h3 class="report-heading">Més registres</h3>
    ${top.length ? rankingRowsHtml(top, false) : '<p class="report-note">Cap registre en aquest període.</p>'}
    ${stats.ranking.length > top.length ? `<button class="link-button" type="button" data-goto-view="ranking">Veure el rànquing complet (${stats.ranking.length})</button>` : ''}

    <h3 class="report-heading">Evolució de les darreres 8 setmanes</h3>
    ${weeklyBarsHtml(stats)}
  `;
}

function renderRankingView(stats) {
  const zeroCount = Math.max(0, stats.population.length - stats.ranking.filter((entry) => {
    const info = stats.studentMap.get(entry.id);
    return info && info.actiu;
  }).length);

  reportContent.innerHTML = `
    <p class="report-context">${escapeHtml(contextLabel(stats))}</p>
    <p class="report-note">${stats.ranking.length} ${stats.ranking.length === 1 ? 'alumne amb registres' : 'alumnes amb registres'} · ${zeroCount} sense cap registre. Toca un alumne per veure els dies.</p>
    <input class="report-input ranking-search" id="ranking-search" type="search" placeholder="Cerca un alumne" value="${escapeHtml(dashboardState.search)}" autocomplete="off">
    <div id="ranking-list"></div>
  `;

  dashboardState.lastStats = stats;
  renderRankingList();
}

function renderRankingList() {
  const container = document.getElementById('ranking-list');
  const stats = dashboardState.lastStats;

  if (!container || !stats) {
    return;
  }

  const term = normalizeSearch(dashboardState.search);
  const entries = stats.ranking.filter((entry) => !term || normalizeSearch(entry.nom).includes(term));

  container.innerHTML = entries.length
    ? rankingRowsHtml(entries, true)
    : emptyReportHtml(stats.ranking.length ? 'Cap alumne coincideix amb la cerca.' : 'Cap registre en aquest període.');
}

function rankingRowsHtml(entries, expandable) {
  return `<ol class="rank-list">${entries.map((entry) => {
    const level = entry.total >= HIGH_REPEAT_THRESHOLD ? 'is-high' : entry.total >= REPEAT_THRESHOLD ? 'is-medium' : '';
    const isOpen = expandable && dashboardState.expanded.has(entry.id);

    return `
      <li class="rank-item ${isOpen ? 'is-expanded' : ''}">
        <button class="rank-row" type="button" ${expandable ? `data-expand="${escapeHtml(entry.id)}" aria-expanded="${isOpen}"` : 'data-goto-view="ranking"'}>
          <span class="rank-pos">${entry.rank}</span>
          <span class="rank-name">
            <span class="rank-name__text">${escapeHtml(entry.nom)}</span>
            <span class="rank-name__meta">${escapeHtml(entry.curs)} · darrer ${escapeHtml(formatShortDate(entry.lastDate))}</span>
          </span>
          <span class="rank-total ${level}">${entry.total}</span>
        </button>
        ${isOpen ? `<div class="rank-dates">${entry.dates.map((date) => `<span class="date-chip">${escapeHtml(formatDateWithWeekday(date))}</span>`).join('')}</div>` : ''}
      </li>
    `;
  }).join('')}</ol>`;
}

function renderCoursesView(stats) {
  const data = dashboardState.data;
  const range = stats.range;
  const courses = stats.course ? [stats.course] : COURSES;

  const summaries = courses.map((course) => {
    const rows = (data.registers || []).filter((row) => row[2] === course && row[0] >= range.from && row[0] <= stats.today);
    const counts = new Map();
    rows.forEach(([, id]) => counts.set(id, (counts.get(id) || 0) + 1));
    const population = (data.students || []).filter(([, , curs, actiu]) => actiu && curs === course).length;
    const affected = counts.size;
    const repeaters = [...counts.values()].filter((total) => total >= REPEAT_THRESHOLD).length;

    return {
      course,
      total: rows.length,
      population,
      affected,
      repeaters,
      percentage: population ? Math.round((affected / population) * 100) : 0,
      perStudent: population ? (rows.length / population).toFixed(1).replace('.', ',') : '0'
    };
  });

  const max = Math.max(1, ...summaries.map((item) => item.total));

  reportContent.innerHTML = `
    <p class="report-context">${escapeHtml(PERIOD_LABELS[stats.period])}</p>
    <p class="report-note">Toca un curs per veure'n el rànquing.</p>
    <div class="course-cards">
      ${summaries.map((item) => `
        <button class="course-card" type="button" data-goto-course="${escapeHtml(item.course)}">
          <span class="course-card__top">
            <span class="course-card__name">${escapeHtml(item.course)}</span>
            <span class="course-card__total">${item.total}</span>
          </span>
          <span class="bar"><span class="bar__fill" style="width:${Math.round((item.total / max) * 100)}%"></span></span>
          <span class="course-card__facts">
            <span><strong>${item.affected}</strong> de ${item.population} alumnes (${item.percentage}%)</span>
            <span><strong>${item.perStudent}</strong> per alumne</span>
            <span class="${item.repeaters ? 'is-warning-text' : ''}"><strong>${item.repeaters}</strong> reincidents</span>
          </span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderDaysView(stats) {
  const totals = WEEKDAYS.map(() => 0);
  const byDate = new Map();

  stats.rows.forEach(([date, id]) => {
    const weekday = getIsoWeekday(date);
    if (weekday >= 1 && weekday <= 5) {
      totals[weekday - 1] += 1;
    }
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date).push(id);
  });

  const total = totals.reduce((sum, value) => sum + value, 0);
  const max = Math.max(1, ...totals);
  const recentDates = [...byDate.keys()].sort().reverse().slice(0, 15);

  reportContent.innerHTML = `
    <p class="report-context">${escapeHtml(contextLabel(stats))}</p>
    <h3 class="report-heading">Per dia de la setmana</h3>
    <div class="bar-list">
      ${WEEKDAYS.map((label, index) => `
        <div class="bar-row ${totals[index] === max && total > 0 ? 'is-top' : ''}">
          <span class="bar-row__label">${label}</span>
          <span class="bar"><span class="bar__fill" style="width:${Math.round((totals[index] / max) * 100)}%"></span></span>
          <span class="bar-row__value">${totals[index]}${total ? ` <small>${Math.round((totals[index] / total) * 100)}%</small>` : ''}</span>
        </div>
      `).join('')}
    </div>

    <h3 class="report-heading">Darrers dies amb registre</h3>
    ${recentDates.length ? `<ol class="rank-list">${recentDates.map((date) => {
      const ids = byDate.get(date);
      const isOpen = dashboardState.expanded.has(`date:${date}`);
      const names = ids
        .map((id) => (stats.studentMap.get(id) || { nom: id }).nom)
        .sort((a, b) => a.localeCompare(b, 'ca'));

      return `
        <li class="rank-item ${isOpen ? 'is-expanded' : ''}">
          <button class="rank-row" type="button" data-expand="date:${escapeHtml(date)}" aria-expanded="${isOpen}">
            <span class="rank-name"><span class="rank-name__text">${escapeHtml(formatDateWithWeekday(date))}</span></span>
            <span class="rank-total">${ids.length}</span>
          </button>
          ${isOpen ? `<div class="rank-dates">${names.map((name) => `<span class="date-chip">${escapeHtml(name)}</span>`).join('')}</div>` : ''}
        </li>
      `;
    }).join('')}</ol>` : '<p class="report-note">Cap registre en aquest període.</p>'}
  `;
}

function handleReportClick(event) {
  const expandButton = event.target.closest('[data-expand]');
  const gotoView = event.target.closest('[data-goto-view]');
  const gotoCourse = event.target.closest('[data-goto-course]');

  if (expandButton) {
    const key = expandButton.dataset.expand;
    if (dashboardState.expanded.has(key)) {
      dashboardState.expanded.delete(key);
    } else {
      dashboardState.expanded.add(key);
    }

    if (dashboardState.prefs.view === 'ranking') {
      renderRankingList();
    } else {
      renderDashboard();
    }
    return;
  }

  if (gotoCourse) {
    updatePrefs({ course: gotoCourse.dataset.gotoCourse, view: 'ranking' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (gotoView) {
    updatePrefs({ view: gotoView.dataset.gotoView });
  }
}

function kpiHtml(value, label, note, modifier = '') {
  return `
    <div class="kpi ${modifier}">
      <span class="kpi__value">${escapeHtml(String(value))}</span>
      <span class="kpi__label">${escapeHtml(label)}</span>
      ${note ? `<span class="kpi__note">${escapeHtml(note)}</span>` : ''}
    </div>
  `;
}

function weeklyBarsHtml(stats) {
  const currentMonday = getMonday(stats.today);
  const weeks = [];

  for (let i = 7; i >= 0; i -= 1) {
    const monday = addDays(currentMonday, -7 * i);
    weeks.push({ monday, friday: addDays(monday, 4), sunday: addDays(monday, 6), total: 0 });
  }

  stats.allRows.forEach(([date]) => {
    const week = weeks.find((item) => date >= item.monday && date <= item.sunday);
    if (week) {
      week.total += 1;
    }
  });

  const max = Math.max(1, ...weeks.map((week) => week.total));

  return `
    <div class="bar-list">
      ${weeks.map((week, index) => `
        <div class="bar-row ${index === weeks.length - 1 ? 'is-current' : ''}">
          <span class="bar-row__label">${escapeHtml(formatWeekLabel(week.monday, week.friday))}</span>
          <span class="bar"><span class="bar__fill" style="width:${Math.round((week.total / max) * 100)}%"></span></span>
          <span class="bar-row__value">${week.total}</span>
        </div>
      `).join('')}
    </div>
  `;
}

async function shareCurrentReport() {
  if (!dashboardState.data) {
    return;
  }

  const stats = buildStats();
  const populationSize = stats.population.length;
  const percentage = populationSize ? Math.round((stats.ranking.length / populationSize) * 100) : 0;
  const lines = [
    `Registre de l'ús del polo · ${contextLabel(stats)}`,
    `Registres: ${stats.rows.length} · Alumnes: ${stats.ranking.length}${populationSize ? ` (${percentage}%)` : ''}`,
    `Reincidents (${REPEAT_THRESHOLD} o més): ${stats.ranking.filter((entry) => entry.total >= REPEAT_THRESHOLD).length}`,
    ''
  ];

  if (stats.ranking.length) {
    lines.push('Rànquing:');
    stats.ranking.slice(0, 20).forEach((entry) => {
      lines.push(`${entry.rank}. ${entry.nom}${stats.course ? '' : ` (${entry.curs})`}: ${entry.total}`);
    });
    if (stats.ranking.length > 20) {
      lines.push(`… i ${stats.ranking.length - 20} alumnes més.`);
    }
  }

  const text = lines.join('\n');

  try {
    if (navigator.share) {
      await navigator.share({ title: 'Registre de l\'ús del polo', text });
      return;
    }

    await navigator.clipboard.writeText(text);
    showStatus('Resum copiat. Ja el pots enganxar al correu o al xat.', 'success');
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return;
    }
    showStatus('No s\'ha pogut compartir el resum.', 'error');
  }
}

/* ---------- Dates ---------- */

function parseDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = parseDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

function getIsoWeekday(dateString) {
  const day = parseDate(dateString).getUTCDay();
  return day === 0 ? 7 : day;
}

function getMonday(dateString) {
  return addDays(dateString, 1 - getIsoWeekday(dateString));
}

// Trimestres escolars aproximats: setembre-desembre, gener-març i abril-juny.
function getPeriodRange(period, today) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const schoolYear = month >= 9 ? year : year - 1;

  if (period === 'week') {
    return { from: getMonday(today) };
  }

  if (period === 'month') {
    return { from: `${today.slice(0, 7)}-01` };
  }

  if (period === 'term') {
    if (month >= 9) {
      return { from: `${year}-09-01` };
    }
    return { from: month <= 3 ? `${year}-01-01` : `${year}-04-01` };
  }

  if (period === 'year') {
    return { from: `${schoolYear}-09-01` };
  }

  return { from: '0000-00-00' };
}

function formatDisplayDate(dateString) {
  const parts = String(dateString || '').split('-');

  if (parts.length !== 3) {
    return String(dateString || '');
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatShortDate(dateString) {
  const parts = String(dateString || '').split('-');
  return parts.length === 3 ? `${Number(parts[2])}/${Number(parts[1])}` : '';
}

function formatDateWithWeekday(dateString) {
  return `${WEEKDAY_ABBR[getIsoWeekday(dateString) - 1]} ${formatDisplayDate(dateString)}`;
}

function formatWeekLabel(monday, friday) {
  return `${formatShortDate(monday)}–${formatShortDate(friday)}`;
}

/* ---------- Utilitats ---------- */

async function fetchApi(action, params, errorMessage) {
  const url = new URL(API_BASE_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('_ts', String(Date.now()));

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('El backend no respon correctament.');
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || errorMessage);
  }

  if (action === 'getStudents') {
    return {
      students: data.students,
      today: data.today
    };
  }

  if (action === 'registerStudent' || action === 'unregisterStudent') {
    return data;
  }

  return data.summary;
}

function emptyReportHtml(message) {
  return `
    <div class="empty-state">
      <p class="empty-title">Sense dades</p>
      <p class="empty-text">${escapeHtml(message)}</p>
    </div>
  `;
}

// L'avís flota sobre la pàgina i no altera l'alçada de la llista ni el desplaçament.
function showStatus(message, type) {
  window.clearTimeout(statusTimer);
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
  statusTimer = window.setTimeout(hideStatus, type === 'error' ? STATUS_HIDE_MS * 2 : STATUS_HIDE_MS);
}

function hideStatus() {
  window.clearTimeout(statusTimer);
  statusBox.className = 'status hidden';
  statusBox.textContent = '';
}

function showInstallBanner({ title, text, actionLabel = 'Instal·la' }) {
  if (isStandaloneMode()) {
    hideInstallBanner();
    return;
  }

  installTitle.textContent = title;
  installText.textContent = text;
  installActionButton.textContent = actionLabel;
  installBanner.classList.remove('hidden');
  document.body.classList.add('has-install-banner');
}

function hideInstallBanner() {
  installBanner.classList.add('hidden');
  document.body.classList.remove('has-install-banner');
}

function setupInstallExperience() {
  if (isStandaloneMode()) {
    hideInstallBanner();
    return;
  }

  if (isIosDevice()) {
    showInstallBanner({
      title: 'Afegeix-la a la pantalla d\'inici',
      text: 'A Safari, toca Compartir i després Afegeix a la pantalla d\'inici.',
      actionLabel: 'Mostra passos'
    });
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // Si falla el registre, l'app continua funcionant com a web.
    });
  });
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function setActiveCourse(course) {
  courseButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.course === course);
  });
}

function readStorage(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Sense emmagatzematge local, l'app continua funcionant amb dades de la xarxa.
  }
}

function normalizeSearch(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function cssEscape(value) {
  return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
