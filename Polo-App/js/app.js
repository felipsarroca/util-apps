const COURSES = ['1r ESO', '2n ESO', '3r ESO', '4t ESO'];
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbx38uh7P5qqE6HgRWGNKI29KeZbGRCMlO2zz4Eu3VRi246c3nutH_M01ZxKDWvy41o/exec';

const REPORT_CONFIG = {
  overview: {
    title: 'Vista general',
    subtitle: 'Resum ràpid de tota l ESO.'
  },
  course: {
    title: 'Dades per curs',
    subtitle: 'Comparativa clara dels quatre cursos.'
  },
  student: {
    title: 'Dades per alumne',
    subtitle: 'Seguiment individual per detectar casos recurrents.'
  },
  weekday: {
    title: 'Dades per dia',
    subtitle: 'Patrons segons el dia de la setmana.'
  }
};

const REPORT_ENDPOINTS = {
  overview: {
    action: 'getOverviewSummary',
    errorMessage: 'No s ha pogut carregar la vista general.'
  },
  course: {
    action: 'getCourseSummary',
    errorMessage: 'No s han pogut carregar les dades per curs.'
  },
  student: {
    action: 'getStudentSummary',
    errorMessage: 'No s han pogut carregar les dades per alumne.'
  },
  weekday: {
    action: 'getWeekdaySummary',
    errorMessage: 'No s han pogut carregar les dades per dia.'
  }
};

const registerScreen = document.getElementById('register-screen');
const consultationsScreen = document.getElementById('consultations-screen');
const studentsPanel = document.getElementById('students-panel');
const studentsList = document.getElementById('students-list');
const statusBox = document.getElementById('status-box');
const courseButtons = document.querySelectorAll('.course-button');
const openConsultationsButton = document.getElementById('open-consultations');
const backToRegisterButton = document.getElementById('back-to-register');
const consultationButtons = document.querySelectorAll('.consultation-button');
const reportTitle = document.getElementById('report-title');
const reportSubtitle = document.getElementById('report-subtitle');
const reportFilters = document.getElementById('report-filters');
const reportContent = document.getElementById('report-content');
const installBanner = document.getElementById('install-banner');
const installTitle = document.getElementById('install-title');
const installText = document.getElementById('install-text');
const installActionButton = document.getElementById('install-action');
const installDismissButton = document.getElementById('install-dismiss');

const reportCache = {
  overview: null,
  course: null,
  student: null,
  weekday: null
};

let deferredInstallPrompt = null;

courseButtons.forEach((button) => {
  button.addEventListener('click', () => {
    openCourse(button.dataset.course);
  });
});

openConsultationsButton.addEventListener('click', async () => {
  registerScreen.classList.add('hidden');
  consultationsScreen.classList.remove('hidden');
  hideStatus();

  if (!reportCache.overview) {
    await openReport('overview');
  }
});

backToRegisterButton.addEventListener('click', () => {
  consultationsScreen.classList.add('hidden');
  registerScreen.classList.remove('hidden');
  hideStatus();
});

consultationButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    await openReport(button.dataset.report);
  });
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
      showStatus('L app s està instal·lant al dispositiu.', 'success');
    }

    deferredInstallPrompt = null;
    return;
  }

  if (isIosDevice() && !isStandaloneMode()) {
    showStatus('A Safari toca Compartir i després Afegeix a la pantalla d inici.', 'warning');
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

async function openCourse(course) {
  if (!COURSES.includes(course)) {
    showStatus('Curs no vàlid.', 'error');
    return;
  }

  setActiveCourse(course);
  studentsPanel.classList.remove('hidden');
  hideStatus();
  studentsList.innerHTML = `
    <div class="student-card loading-card">
      <p class="student-name">Carregant alumnat...</p>
    </div>
  `;

  try {
    const result = await fetchApi('getStudents', { curs: course }, 'No s ha pogut carregar l alumnat.');
    renderStudents(result);
  } catch (error) {
    studentsList.innerHTML = '';
    showStatus(error.message || 'No s ha pogut carregar l alumnat.', 'error');
  }
}

function renderStudents(result) {
  const students = Array.isArray(result.students) ? result.students : [];

  if (students.length === 0) {
    studentsList.innerHTML = `
      <div class="student-card">
        <p class="student-name">No hi ha alumnat per a aquest curs.</p>
      </div>
    `;
    return;
  }

  studentsList.innerHTML = students.map((student) => `
    <div class="student-card ${student.registeredToday ? 'is-registered' : 'is-pending'}" data-student-card="${escapeHtml(student.id_alumne)}">
      <div class="student-row">
        <button
          class="student-action ${student.registeredToday ? 'is-done' : 'is-ready'}"
          type="button"
          data-student-id="${escapeHtml(student.id_alumne)}"
          ${student.registeredToday ? 'disabled' : ''}
          aria-label="${student.registeredToday ? 'Alumne marcat com a sense polo' : 'Marcar alumne com a sense polo'}"
        >
          <span class="student-action-icon" aria-hidden="true">${student.registeredToday ? '&#10005;' : '&#10003;'}</span>
        </button>
        <div class="student-main">
          <p class="student-name">${escapeHtml(student.nom_complet)}</p>
        </div>
      </div>
    </div>
  `).join('');

  studentsList.querySelectorAll('.student-action').forEach((button) => {
    button.addEventListener('click', async () => {
      if (button.disabled) {
        return;
      }

      await handleRegisterStudent(button, button.dataset.studentId);
    });
  });
}

async function handleRegisterStudent(button, studentId) {
  const card = button.closest('.student-card');
  const originalHtml = button.innerHTML;

  button.disabled = true;
  button.classList.add('is-loading');
  hideStatus();

  try {
    const result = await fetchApi(
      'registerStudent',
      { studentId },
      'No s ha pogut registrar l alumne.'
    );

    if (result.status === 'registered') {
      clearReportCache();
      showStatus(`${result.student.nom_complet} registrat com a alumne sense polo.`, 'success');
      markStudentAsDone(card, button);
    } else if (result.status === 'duplicate') {
      showStatus('Ja s\'havia registrat avui.', 'warning');
      markStudentAsDone(card, button);
    } else {
      showStatus(result.message || 'Resposta inesperada del backend.', 'error');
    }
  } catch (error) {
    showStatus(error.message || 'No s ha pogut registrar l alumne.', 'error');
  } finally {
    if (!button.classList.contains('is-done')) {
      button.classList.remove('is-loading');
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  }
}

async function openReport(reportType) {
  const config = REPORT_CONFIG[reportType];

  if (!config) {
    return;
  }

  setActiveReportButton(reportType);
  reportTitle.textContent = config.title;
  reportSubtitle.textContent = 'Carregant dades...';
  reportFilters.classList.add('hidden');
  reportFilters.innerHTML = '';
  reportContent.innerHTML = `
    <div class="report-card">
      <p class="report-note">Carregant dades...</p>
    </div>
  `;

  try {
    const summary = await getReportSummary(reportType);

    if (reportType === 'overview') {
      renderOverviewReport(summary);
      return;
    }

    if (reportType === 'course') {
      renderCourseReport(summary);
      return;
    }

    if (reportType === 'student') {
      renderStudentReport(summary);
      return;
    }

    if (reportType === 'weekday') {
      renderWeekdayReport(summary);
    }
  } catch (error) {
    reportSubtitle.textContent = error.message || 'No s han pogut carregar les dades.';
    reportFilters.classList.add('hidden');
    reportFilters.innerHTML = '';
    reportContent.innerHTML = `
      <div class="report-card">
        <p class="report-note">${escapeHtml(error.message || 'Error desconegut.')}</p>
      </div>
    `;
  }
}

async function getReportSummary(reportType) {
  if (reportCache[reportType]) {
    return reportCache[reportType];
  }

  const endpoint = REPORT_ENDPOINTS[reportType];
  const summary = await fetchApi(endpoint.action, {}, endpoint.errorMessage);
  reportCache[reportType] = summary;
  return summary;
}

function renderOverviewReport(summary) {
  reportTitle.textContent = REPORT_CONFIG.overview.title;
  reportSubtitle.textContent = 'Resum global de tota l ESO.';
  reportFilters.classList.add('hidden');
  reportFilters.innerHTML = '';

  const totalRegisters = summary.totalRegisters || 0;
  const topCourse = summary.topCourse
    ? `${summary.topCourse.curs} (${summary.topCourse.total})`
    : 'Sense dades';
  const topStudent = summary.topStudent
    ? `${summary.topStudent.nom_complet} (${summary.topStudent.total})`
    : 'Sense dades';
  const latestDate = summary.latestRecordDate || 'Sense dades';

  reportContent.innerHTML = `
    ${buildMetricCard('Total de registres', String(totalRegisters), 'Visió ràpida del volum total acumulat.')}
    ${buildMetricCard('Curs amb més registres', topCourse, '')}
    ${buildMetricCard('Alumne amb més registres', topStudent, '')}
    ${buildMetricCard('Últim dia amb registre', latestDate, '')}
  `;
}

function renderCourseReport(summary) {
  reportTitle.textContent = REPORT_CONFIG.course.title;
  reportSubtitle.textContent = 'Filtra per classe per veure el detall d\'un sol curs o compara tots els grups.';

  if (!summary.courses || summary.courses.length === 0) {
    reportFilters.classList.add('hidden');
    reportFilters.innerHTML = '';
    reportContent.innerHTML = emptyReportHtml('Encara no hi ha registres per mostrar.');
    return;
  }

  reportFilters.classList.remove('hidden');
  reportFilters.innerHTML = `
    <div class="filters-card">
      <p class="filters-title">Filtra la consulta</p>
      <div class="report-controls report-controls--single">
        <label class="filter-field">
          <span class="filter-label">Classe</span>
          <select class="report-select" id="course-filter">
            <option value="">Totes les classes</option>
            ${summary.courses.map((course) => `<option value="${escapeHtml(course.curs)}">${escapeHtml(course.curs)}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>
  `;

  const courseFilter = document.getElementById('course-filter');

  const renderFilteredCourses = () => {
    const selectedCourse = courseFilter.value;
    const filteredCourses = summary.courses.filter((course) => !selectedCourse || course.curs === selectedCourse);

    if (filteredCourses.length === 0) {
      reportContent.innerHTML = emptyReportHtml('Cap curs coincideix amb el filtre.');
      return;
    }

    reportContent.innerHTML = filteredCourses.map((course) => `
      <div class="report-card">
        <div class="report-row">
          <p class="report-label">${escapeHtml(course.curs)}</p>
          <p class="report-value">${escapeHtml(String(course.totalRegisters))}</p>
        </div>
        <p class="report-note">${escapeHtml(`${course.studentsWithIncidents} alumnes afectats`)}</p>
      </div>
    `).join('');
  };

  courseFilter.addEventListener('change', renderFilteredCourses);
  renderFilteredCourses();
}

function renderStudentReport(summary) {
  reportTitle.textContent = REPORT_CONFIG.student.title;
  reportSubtitle.textContent = 'Busca un alumne concret o limita la consulta a una classe.';

  if (!summary.students || summary.students.length === 0) {
    reportFilters.classList.add('hidden');
    reportFilters.innerHTML = '';
    reportContent.innerHTML = emptyReportHtml('Encara no hi ha registres per mostrar.');
    return;
  }

  reportFilters.classList.remove('hidden');
  reportFilters.innerHTML = `
    <div class="filters-card">
      <p class="filters-title">Filtra la consulta</p>
      <div class="report-controls">
        <label class="filter-field filter-field--wide">
          <span class="filter-label">Cercar alumne</span>
          <input class="report-input" id="student-search" type="text" placeholder="Escriu un nom">
        </label>
        <label class="filter-field">
          <span class="filter-label">Classe</span>
          <select class="report-select" id="student-course-filter">
            <option value="">Tots els cursos</option>
            ${COURSES.map((course) => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>
  `;

  const searchInput = document.getElementById('student-search');
  const courseFilter = document.getElementById('student-course-filter');

  const renderFilteredStudents = () => {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCourse = courseFilter.value;

    const filteredStudents = summary.students.filter((student) => {
      const studentName = String(student.nom_complet || '').toLowerCase();
      const matchesText = !searchTerm || studentName.includes(searchTerm);
      const matchesCourse = !selectedCourse || student.curs === selectedCourse;
      return matchesText && matchesCourse;
    });

    if (filteredStudents.length === 0) {
      reportContent.innerHTML = emptyReportHtml('Cap alumne coincideix amb el filtre.');
      return;
    }

    reportContent.innerHTML = filteredStudents.map((student, index) => `
      <button class="report-card report-card-button" type="button" data-student-detail="${escapeHtml(student.id_alumne)}">
        <div class="report-row">
          <p class="report-label">${escapeHtml(`${index + 1}. ${student.nom_complet}`)}</p>
          <p class="report-value">${escapeHtml(String(student.totalRegisters))}</p>
        </div>
        <p class="report-note">${escapeHtml(student.curs)}</p>
        <div class="student-history hidden" data-student-history="${escapeHtml(student.id_alumne)}">
          <p class="student-history-title">Dies registrats</p>
          ${buildStudentHistoryHtml(student.history)}
        </div>
      </button>
    `).join('');

    reportContent.querySelectorAll('[data-student-detail]').forEach((button) => {
      button.addEventListener('click', () => {
        toggleStudentHistory(button.dataset.studentDetail);
      });
    });
  };

  searchInput.addEventListener('input', renderFilteredStudents);
  courseFilter.addEventListener('change', renderFilteredStudents);
  renderFilteredStudents();
}

function renderWeekdayReport(summary) {
  reportTitle.textContent = REPORT_CONFIG.weekday.title;
  reportSubtitle.textContent = 'Selecciona un dia concret o mantén la vista completa per detectar patrons.';

  if (!summary.days || summary.days.length === 0) {
    reportFilters.classList.add('hidden');
    reportFilters.innerHTML = '';
    reportContent.innerHTML = emptyReportHtml('Encara no hi ha registres per mostrar.');
    return;
  }

  reportFilters.classList.remove('hidden');
  reportFilters.innerHTML = `
    <div class="filters-card">
      <p class="filters-title">Filtra la consulta</p>
      <div class="report-controls report-controls--single">
        <label class="filter-field">
          <span class="filter-label">Dia de la setmana</span>
          <select class="report-select" id="weekday-filter">
            <option value="">Tots els dies</option>
            ${summary.days.map((day) => `<option value="${escapeHtml(day.label)}">${escapeHtml(day.label)}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>
  `;

  const weekdayFilter = document.getElementById('weekday-filter');

  const renderFilteredDays = () => {
    const selectedDay = weekdayFilter.value;
    const filteredDays = summary.days.filter((day) => !selectedDay || day.label === selectedDay);

    if (filteredDays.length === 0) {
      reportContent.innerHTML = emptyReportHtml('Cap dia coincideix amb el filtre.');
      return;
    }

    reportContent.innerHTML = filteredDays.map((day) => `
      <div class="report-card">
        <div class="report-row">
          <p class="report-label">${escapeHtml(day.label)}</p>
          <p class="report-value">${escapeHtml(String(day.totalRegisters))}</p>
        </div>
      </div>
    `).join('');
  };

  weekdayFilter.addEventListener('change', renderFilteredDays);
  renderFilteredDays();
}

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

  if (action === 'registerStudent') {
    return data;
  }

  return data.summary;
}

function buildMetricCard(label, value, note) {
  return `
    <div class="report-card">
      <div class="report-row">
        <p class="report-label">${escapeHtml(label)}</p>
        <p class="report-value">${escapeHtml(value)}</p>
      </div>
      ${note ? `<p class="report-note">${escapeHtml(note)}</p>` : ''}
    </div>
  `;
}

function buildStudentHistoryHtml(history) {
  const entries = Array.isArray(history) ? history : [];

  if (entries.length === 0) {
    return '<p class="report-note">No hi ha cap registre detallat.</p>';
  }

  return `
    <div class="student-history-list">
      ${entries.map((entry) => `
        <div class="student-history-item">
          <span>${escapeHtml(formatDisplayDate(entry.data))}</span>
          <span>${escapeHtml(entry.diaSetmana || '')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function emptyReportHtml(message) {
  return `
    <div class="empty-state">
      <p class="empty-title">Sense dades</p>
      <p class="empty-text">${escapeHtml(message)}</p>
    </div>
  `;
}

function toggleStudentHistory(studentId) {
  reportContent.querySelectorAll('[data-student-detail]').forEach((button) => {
    const historyElement = button.querySelector('[data-student-history]');
    const isCurrent = button.dataset.studentDetail === studentId;

    if (!historyElement) {
      return;
    }

    if (isCurrent) {
      const shouldOpen = historyElement.classList.contains('hidden');
      historyElement.classList.toggle('hidden', !shouldOpen);
      button.classList.toggle('is-expanded', shouldOpen);
    } else {
      historyElement.classList.add('hidden');
      button.classList.remove('is-expanded');
    }
  });
}

function formatDisplayDate(dateString) {
  const parts = String(dateString || '').split('-');

  if (parts.length !== 3) {
    return String(dateString || '');
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

function hideStatus() {
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
}

function hideInstallBanner() {
  installBanner.classList.add('hidden');
}

function setupInstallExperience() {
  if (isStandaloneMode()) {
    hideInstallBanner();
    return;
  }

  if (isIosDevice()) {
    showInstallBanner({
      title: 'Afegeix-la a la pantalla d inici',
      text: 'A Safari, toca Compartir i després Afegeix a la pantalla d inici.',
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

function setActiveReportButton(reportType) {
  consultationButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.report === reportType);
  });
}

function clearReportCache() {
  Object.keys(reportCache).forEach((key) => {
    reportCache[key] = null;
  });
}

function markStudentAsDone(card, button) {
  if (card) {
    card.classList.add('is-registered');
    card.classList.remove('is-pending');
  }

  button.disabled = true;
  button.classList.remove('is-loading');
  button.classList.remove('is-ready');
  button.innerHTML = '<span class="student-action-icon" aria-hidden="true">&#10005;</span>';
  button.setAttribute('aria-label', 'Alumne marcat com a sense polo');
  button.classList.add('is-done');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
