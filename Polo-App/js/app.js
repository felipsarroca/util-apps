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
const reportContent = document.getElementById('report-content');

courseButtons.forEach((button) => {
  button.addEventListener('click', () => {
    openCourse(button.dataset.course);
  });
});

openConsultationsButton.addEventListener('click', () => {
  registerScreen.classList.add('hidden');
  consultationsScreen.classList.remove('hidden');
  hideStatus();
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
          <span class="student-action-icon" aria-hidden="true">${student.registeredToday ? '✕' : '✓'}</span>
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
      { studentId: studentId },
      'No s ha pogut registrar l alumne.'
    );

    if (result.status === 'registered') {
      showStatus(`${result.student.nom_complet} registrat com a alumne sense polo.`, 'success');
      markStudentAsDone(card, button);
    } else if (result.status === 'duplicate') {
      showStatus('Ja estava registrat avui', 'warning');
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

  reportTitle.textContent = config.title;
  reportSubtitle.textContent = 'Carregant dades...';
  reportContent.innerHTML = `
    <div class="report-card">
      <p class="report-note">Carregant dades...</p>
    </div>
  `;

  try {
    if (reportType === 'overview') {
      const summary = await fetchApi(
        'getOverviewSummary',
        {},
        'No s ha pogut carregar la vista general.'
      );
      renderOverviewReport(summary);
      return;
    }

    if (reportType === 'course') {
      const summary = await fetchApi(
        'getCourseSummary',
        {},
        'No s han pogut carregar les dades per curs.'
      );
      renderCourseReport(summary);
      return;
    }

    if (reportType === 'student') {
      const summary = await fetchApi(
        'getStudentSummary',
        {},
        'No s han pogut carregar les dades per alumne.'
      );
      renderStudentReport(summary);
      return;
    }

    if (reportType === 'weekday') {
      const summary = await fetchApi(
        'getWeekdaySummary',
        {},
        'No s han pogut carregar les dades per dia.'
      );
      renderWeekdayReport(summary);
    }
  } catch (error) {
    reportSubtitle.textContent = error.message || 'No s han pogut carregar les dades.';
    reportContent.innerHTML = `
      <div class="report-card">
        <p class="report-note">${escapeHtml(error.message || 'Error desconegut.')}</p>
      </div>
    `;
  }
}

function renderOverviewReport(summary) {
  reportTitle.textContent = REPORT_CONFIG.overview.title;
  reportSubtitle.textContent = REPORT_CONFIG.overview.subtitle;

  const totalRegisters = summary.totalRegisters || 0;
  const topCourse = summary.topCourse
    ? `${summary.topCourse.curs} (${summary.topCourse.total})`
    : 'Sense dades';
  const topStudent = summary.topStudent
    ? `${summary.topStudent.nom_complet} (${summary.topStudent.total})`
    : 'Sense dades';
  const latestDate = summary.latestRecordDate || 'Sense dades';

  reportContent.innerHTML = `
    ${buildMetricCard('Total de registres', String(totalRegisters), '')}
    ${buildMetricCard('Curs amb més registres', topCourse, '')}
    ${buildMetricCard('Alumne amb més registres', topStudent, '')}
    ${buildMetricCard('Últim dia amb registre', latestDate, '')}
  `;
}

function renderCourseReport(summary) {
  reportTitle.textContent = REPORT_CONFIG.course.title;
  reportSubtitle.textContent = REPORT_CONFIG.course.subtitle;

  if (!summary.courses || summary.courses.length === 0) {
    reportContent.innerHTML = emptyReportHtml('Encara no hi ha registres per mostrar.');
    return;
  }

  reportContent.innerHTML = summary.courses.map((course) => `
    <div class="report-card">
      <div class="report-row">
        <p class="report-label">${escapeHtml(course.curs)}</p>
        <p class="report-value">${escapeHtml(String(course.totalRegisters))}</p>
      </div>
      <p class="report-note">${escapeHtml(`${course.studentsWithIncidents} alumnes afectats`)}</p>
    </div>
  `).join('') + buildMetricCard(
    'Curs amb més incidències',
    summary.topCourse ? `${summary.topCourse.curs} (${summary.topCourse.totalRegisters})` : 'Sense dades',
    ''
  );
}

function renderStudentReport(summary) {
  reportTitle.textContent = REPORT_CONFIG.student.title;
  reportSubtitle.textContent = REPORT_CONFIG.student.subtitle;

  if (!summary.students || summary.students.length === 0) {
    reportContent.innerHTML = emptyReportHtml('Encara no hi ha registres per mostrar.');
    return;
  }

  reportContent.innerHTML = `
    <div class="report-controls">
      <input class="report-input" id="student-search" type="text" placeholder="Buscar alumne">
      <select class="report-select" id="student-course-filter">
        <option value="">Tots els cursos</option>
        ${COURSES.map((course) => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`).join('')}
      </select>
    </div>
    <div id="student-report-list"></div>
  `;

  const searchInput = document.getElementById('student-search');
  const courseFilter = document.getElementById('student-course-filter');
  const listContainer = document.getElementById('student-report-list');

  const renderFilteredStudents = () => {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCourse = courseFilter.value;

    const filteredStudents = summary.students.filter((student) => {
      const matchesText = !searchTerm || student.nom_complet.toLowerCase().includes(searchTerm);
      const matchesCourse = !selectedCourse || student.curs === selectedCourse;
      return matchesText && matchesCourse;
    });

    if (filteredStudents.length === 0) {
      listContainer.innerHTML = emptyReportHtml('Cap alumne coincideix amb el filtre.');
      return;
    }

    listContainer.innerHTML = filteredStudents.map((student, index) => `
      <div class="report-card">
        <div class="report-row">
          <p class="report-label">${escapeHtml(`${index + 1}. ${student.nom_complet}`)}</p>
          <p class="report-value">${escapeHtml(String(student.totalRegisters))}</p>
        </div>
        <p class="report-note">${escapeHtml(student.curs)}</p>
      </div>
    `).join('');
  };

  searchInput.addEventListener('input', renderFilteredStudents);
  courseFilter.addEventListener('change', renderFilteredStudents);
  renderFilteredStudents();
}

function renderWeekdayReport(summary) {
  reportTitle.textContent = REPORT_CONFIG.weekday.title;
  reportSubtitle.textContent = REPORT_CONFIG.weekday.subtitle;

  if (!summary.days || summary.days.length === 0) {
    reportContent.innerHTML = emptyReportHtml('Encara no hi ha registres per mostrar.');
    return;
  }

  reportContent.innerHTML = summary.days.map((day) => `
    <div class="report-card">
      <div class="report-row">
        <p class="report-label">${escapeHtml(day.label)}</p>
        <p class="report-value">${escapeHtml(String(day.totalRegisters))}</p>
      </div>
    </div>
  `).join('') + buildMetricCard(
    'Dia amb més registres',
    summary.topDay ? `${summary.topDay.label} (${summary.topDay.totalRegisters})` : 'Sense dades',
    ''
  );
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

function emptyReportHtml(message) {
  return `
    <div class="empty-state">
      <p class="empty-title">Sense dades</p>
      <p class="empty-text">${escapeHtml(message)}</p>
    </div>
  `;
}

function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

function hideStatus() {
  statusBox.className = 'status hidden';
  statusBox.textContent = '';
}

function setActiveCourse(course) {
  courseButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.course === course);
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
  button.innerHTML = '<span class="student-action-icon" aria-hidden="true">✕</span>';
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
