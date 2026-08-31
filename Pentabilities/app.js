const config = window.PENTABILITIES_CONFIG || {};
const googleScriptUrl = String(config.googleScriptUrl || '').trim();
const hasGoogleApi = Boolean(googleScriptUrl);
const useSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const hasSupabaseConfig = Boolean(useSupabase && window.supabase);
const db = hasSupabaseConfig ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
let deferredInstallPrompt = null;

const state = {
  boot: null,
  authSession: null,
  authError: '',
  view: 'home',
  selectedCycleId: null,
  enteredSession: null,
  selectedSession: null,
  projectedSession: null,
  dashboard: null,
  homeStats: null,
  homeStatsLoading: false,
  ratings: {}
};

const PREVIEW = loadPreviewData();

function rpc(name, args = {}) {
  if (!db) return Promise.reject(new Error('Encara no hi ha cap projecte Supabase configurat.'));
  return db.rpc(name, args).then(({ data, error }) => {
    if (error) throw new Error(error.message || 'Error de Supabase.');
    return data;
  });
}

async function api(action, payload = {}) {
  const response = await fetch(googleScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload, token: '' })
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'Error de comunicació amb Google Sheets.');
  return result.data;
}

async function boot() {
  if (useSupabase && !hasSupabaseConfig) {
    state.authError = 'No s’ha pogut carregar el servei d’autenticació. Revisa la connexió i torna-ho a provar.';
    state.boot = { needsLogin: true };
    render();
    return;
  }
  if (!useSupabase) {
    state.authError = 'Cal configurar Supabase Auth per poder entrar a Pentabilities.';
    state.boot = { needsLogin: true };
    render();
    return;
  }

  const { data, error } = await db.auth.getSession();
  if (error) {
    state.authError = 'No s’ha pogut comprovar la sessió. Torna-ho a provar.';
    state.authSession = null;
    state.boot = { needsLogin: true };
    render();
    return;
  }

  state.authSession = data.session;
  if (!state.authSession) {
    state.boot = { needsLogin: true };
    render();
    return;
  }

  try {
    state.boot = await rpc('app_bootstrap');
    state.authError = '';
    triggerRosterSyncBackground();
  } catch (error) {
    state.authError = authErrorMessage(error);
    await db.auth.signOut({ scope: 'local' });
    state.authSession = null;
    state.boot = { needsLogin: true };
  }
  render();
}

function render() {
  const root = document.querySelector('#app');
  if (!root) return;

  if (!state.boot || state.boot.needsLogin || !state.boot.user) {
    root.innerHTML = loginView();
    return;
  }

  root.innerHTML = layout(renderView());
  if (state.view === 'newSession') loadStudentsForCycle();
  if (state.view === 'home' && state.boot.user.role !== 'student') loadHomeStats();
  updateInstallButton();
}

function renderView() {
  if (state.view === 'newCycle') return newCycleView();
  if (state.view === 'newSession') return newSessionView();
  if (state.view === 'editSession') return editSessionView();
  if (state.view === 'sessionCreated') return sessionCreatedView();
  if (state.view === 'studentSession') return studentSessionView();
  if (state.view === 'projectCode') return projectCodeView();
  if (state.view === 'teacherEvaluation') return teacherEvaluationView();
  if (state.view === 'dashboard') return dashboardView();
  return homeView();
}

function layout(content) {
  const user = state.boot.user;
  const installButton = user.role !== 'student'
    ? '<button id="install-button" class="secondary install-button" onclick="installApp()" hidden><span class="install-icon" aria-hidden="true"></span>Instal·la</button>'
    : '';

  return `
    <main class="shell">
      <header class="topbar">
        <div class="brand app-brand">
          <img class="brand-logo" src="assets/pentabilities-logo.png" alt="Pentabilities">
          <div class="brand-copy">
            <h1>Pentabilities</h1>
            <div class="muted">${escapeHtml(user.name)} · ${roleLabel(user.role)}</div>
          </div>
        </div>
        <div class="topbar-right">
          <div class="school-brand" aria-label="Escola Ramon Pont">
            <span>Escola Ramon Pont</span>
            <img class="school-logo" src="assets/ramon-pont.png" alt="Escola Ramon Pont">
          </div>
          <div class="toolbar">
            <button class="secondary" onclick="go('home')">Inici</button>
            ${installButton}
            <button class="ghost" onclick="logout()">Sortir</button>
          </div>
        </div>
      </header>
      ${content}
    </main>`;
}

function loginView() {
  if (useSupabase) {
    const message = state.authError
      ? `<div class="notice error">${escapeHtml(state.authError)}</div>`
      : '';
    return `
      <main class="login-shell">
        <section class="login-panel">
          <div class="login-school">
            <img class="login-school-logo" src="assets/ramon-pont.png" alt="Escola Ramon Pont">
            <span>Escola Ramon Pont</span>
          </div>
          <div class="login-brand">
            <img class="login-penta-logo" src="assets/pentabilities-logo.png" alt="Pentabilities">
            <h1>Pentabilities</h1>
          </div>
          <div class="login-google-panel">
            <p>Entra amb el compte de Google vinculat al teu usuari de Pentabilities.</p>
            <button id="login-button" class="google-login-button" type="button" onclick="loginWithGoogle()">
              <span class="google-login-mark" aria-hidden="true">G</span>
              Inicia la sessió amb Google
            </button>
            <p class="login-help">Només hi poden accedir els comptes autoritzats per l’escola.</p>
          </div>
          <div id="message" style="margin-top:12px">${message}</div>
        </section>
      </main>`;
  }

  return `
    <main class="login-shell">
      <section class="login-panel">
        <div class="login-school">
          <img class="login-school-logo" src="assets/ramon-pont.png" alt="Escola Ramon Pont">
          <span>Escola Ramon Pont</span>
        </div>
        <div class="login-brand">
          <img class="login-penta-logo" src="assets/pentabilities-logo.png" alt="Pentabilities">
          <h1>Pentabilities</h1>
        </div>
        <div id="message"><div class="notice error">${escapeHtml(state.authError || 'L’autenticació no està configurada.')}</div></div>
      </section>
    </main>`;
}

function homeView() {
  const user = state.boot.user;
  if (user.role === 'student') return studentHomeView(user);

  const cycles = state.boot.cycles || [];
  const sessions = state.boot.activeSessions || [];
  const homeStats = getHomeStatsForDisplay();
  return `
    <section class="teacher-actions">
      <button class="create-action" onclick="go('newCycle')"><span class="plus-icon" aria-hidden="true"></span>Crear un cicle</button>
      <button class="create-action secondary" onclick="go('newSession')"><span class="plus-icon" aria-hidden="true"></span>Crear una sessió</button>
    </section>
    <section class="dashboard-strip">
      <div class="stat-tile"><span>Cicles</span><strong>${cycles.length}</strong></div>
      <div class="stat-tile"><span>Sessions actives</span><strong>${sessions.length}</strong></div>
      <div class="stat-tile"><span>Alumnes del grup</span><strong id="home-evaluated-students">${homeStats.evaluatedStudents}</strong></div>
      <div class="stat-tile"><span>Comportaments</span><strong id="home-evaluated-behaviors">${homeStats.evaluatedBehaviors}</strong></div>
    </section>
    <section class="grid two">
      <div class="card">
        <h2>Cicles</h2>
        <div class="list">${cycles.length ? cycles.map(cycleCard).join('') : '<p class="muted">Encara no hi ha cicles.</p>'}</div>
      </div>
      <div class="card">
        <h2>Sessions actives</h2>
        <div class="list">${sessions.length ? sessions.map(sessionCard).join('') : '<p class="muted">Encara no hi ha sessions obertes o en esborrany.</p>'}</div>
      </div>
    </section>`;
}

function studentHomeView(user) {
  return `
    <section class="student-entry">
      <div class="card student-code-card">
        <h2>Entrar a una sessió</h2>
        <p class="muted">Escriu el codi que projecta el professor a l'aula.</p>
        <label>Codi de sessió<input id="session-code" class="big-code-input" inputmode="numeric" maxlength="6" placeholder="000000" value="${hasGoogleApi || hasSupabaseConfig ? '' : '123456'}"></label>
        <div class="toolbar" style="margin-top:12px"><button onclick="enterStudentCode()">Entrar</button></div>
        <div id="message" style="margin-top:12px"></div>
      </div>
      <div class="card compact-info">
        <h2>Les teves dades</h2>
        <div class="info-line"><span>Alumne</span><strong>${escapeHtml(user.name)}</strong></div>
        <div class="info-line"><span>Classe</span><strong>${escapeHtml(user.classGroup ? formatClassGroup(user.classGroup) : 'Sense classe assignada')}</strong></div>
      </div>
    </section>`;
}

function cycleCard(cycle) {
  return `
    <div class="cycle-row">
      <div>
        <span class="row-title">${escapeHtml(cycle.name)}</span>
        <div class="row-meta">${escapeHtml(formatClassGroup(cycle.classGroup))} · ${statusLabel(cycle.status)}</div>
      </div>
      <div class="toolbar">
        <button class="secondary new-session-cycle-button" onclick="selectCycle('${cycle.id}')"><span class="button-icon action-symbol plus-symbol" aria-hidden="true"></span>Nova sessió</button>
        <button class="ghost dashboard-cycle-button" onclick="showCycleDashboard('${cycle.id}')"><span class="button-icon action-symbol search-symbol" aria-hidden="true"></span>Dashboard</button>
      </div>
    </div>`;
}

function sessionCard(session) {
  const progress = session.progress || {};
  const locked = Boolean(session.locked);
  const evaluationsCount = session.evaluationsCount ?? progress.evaluationsCount ?? 0;
  const statusText = locked ? 'Bloquejada' : statusLabel(session.status);
  return `
    <div class="cycle-row session-row">
      <div>
        <span class="row-title">${escapeHtml(session.name)}</span>
        <div class="row-meta">${escapeHtml(formatClassGroup(session.classGroup))} · ${statusText}</div>
        <button class="code-box code-button" onclick="projectCodeFromBoot('${session.id}')" title="Projectar codi">${escapeHtml(session.accessCode)}</button>
        <div class="progress-chips">
          <span>Enviats: ${progress.respondents ?? 0}</span>
          <span>Falten: ${progress.pending ?? '-'}</span>
          <span>Total: ${progress.totalStudents ?? '-'}</span>
          <span>Valoracions: ${evaluationsCount}</span>
        </div>
      </div>
      <div class="toolbar session-actions">
        ${session.status === 'draft' ? `<button onclick="openSession('${session.id}')">Obrir</button>` : ''}
        ${session.status === 'open' && !locked ? `<button class="evaluate-action" onclick="loadTeacherEvaluation('${session.id}')"><span class="button-icon eval-symbol" aria-hidden="true"></span>Avaluar</button>` : ''}
        <button class="secondary compact-action edit-action" onclick="editSession('${session.id}')" title="Editar" aria-label="Editar sessió"><span class="button-icon icon-pencil" aria-hidden="true"></span></button>
        <button class="secondary compact-action duplicate-action" onclick="duplicateSession('${session.id}')" title="Duplicar" aria-label="Duplicar sessió"><span class="button-icon icon-copy" aria-hidden="true"></span></button>
        ${locked ? `<button class="secondary compact-action lock-action" onclick="unlockSession('${session.id}')" title="Desbloquejar" aria-label="Desbloquejar sessió"><span class="button-icon icon-play" aria-hidden="true"></span></button>` : `<button class="secondary compact-action lock-action" onclick="lockSession('${session.id}')" title="Bloquejar" aria-label="Bloquejar sessió"><span class="button-icon icon-pause" aria-hidden="true"></span></button>`}
        <button class="danger compact-action delete-action" onclick="deleteSession('${session.id}')" title="Eliminar" aria-label="Eliminar sessió"><span class="button-icon icon-delete" aria-hidden="true"></span></button>
      </div>
    </div>`;
}

function newCycleView() {
  return `
    <section class="form-page cycle-page">
      <div class="form-hero">
        <div>
          <span class="section-kicker">Planificació</span>
          <h2>Crear un cicle</h2>
          <p>Defineix el grup, el període i el context de treball.</p>
        </div>
      </div>
      <form class="visual-form" onsubmit="saveCycle(event)">
        <div class="form-section">
          <h3>Dades bàsiques</h3>
          <div class="grid two">
            <label class="field-card">Nom del cicle<input name="name" required placeholder="Treball cooperatiu 1r trimestre"></label>
            <label class="field-card">Grup o classe<select name="classGroup" required>${(state.boot.classes || []).map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(formatClassGroup(c))}</option>`).join('')}</select></label>
            <label class="field-card">Data d'inici<input name="startsOn" type="date"></label>
            <label class="field-card">Data final prevista<input name="endsOn" type="date"></label>
          </div>
        </div>
        <div class="form-section accent-section">
          <h3>Context per al professorat</h3>
          <label class="field-card wide">Notes<textarea name="notes" placeholder="Objectiu del cicle, projecte, matèria o observacions útils"></textarea></label>
        </div>
        <div class="toolbar form-actions"><button>Guardar cicle</button><button type="button" class="ghost" onclick="go('home')">Cancel·lar</button></div>
      </form>
      <div id="message" style="margin-top:12px"></div>
    </section>`;
}

function newSessionView() {
  const cycles = (state.boot.cycles || []).filter((cycle) => cycle.status === 'active');
  if (!cycles.length) return '<section class="card"><h2>Crear una sessió</h2><p class="muted">Primer cal crear un cicle actiu.</p></section>';
  const cycle = cycles.find((c) => c.id === state.selectedCycleId) || cycles[0];
  state.selectedCycleId = cycle.id;

  return `
    <section class="form-page session-page">
      <div class="form-hero">
        <div>
          <span class="section-kicker">Aula</span>
          <h2>Crear una sessió</h2>
          <p>Tria comportaments, alumnat i estat inicial de la sessió.</p>
        </div>
      </div>
      <form class="visual-form" onsubmit="saveSession(event)">
        <div class="form-section">
          <h3>1. Dades de la sessió</h3>
          <div class="grid two">
            <label class="field-card">Cicle<select name="cycleId" onchange="selectCycle(this.value)">${cycles.map((c) => `<option value="${c.id}" ${c.id === cycle.id ? 'selected' : ''}>${escapeHtml(c.name)} / ${escapeHtml(formatClassGroup(c.classGroup))}</option>`).join('')}</select></label>
            <label class="field-card">Nom de la sessió<input name="name" required placeholder="Projecte de classe"></label>
            <label class="field-card">Data<input name="sessionDate" type="date"></label>
            <label class="field-card">Estat<select name="openNow"><option value="true">Oberta</option><option value="false">Esborrany</option></select></label>
          </div>
        </div>
        <div class="form-section behavior-section">
          <div class="section-heading">
          <div>
            <h3>Comportaments</h3>
            <p class="muted">Tria els comportaments que té sentit observar en aquesta activitat.</p>
          </div>
          <span class="selection-status"><span id="behavior-count">0</span><span>seleccionats</span></span>
          </div>
          ${behaviorSelector()}
        </div>
        <div class="form-section students-section">
          <h3>Alumnes per a heteroavaluació</h3>
          <p class="muted">Opcional: marca els alumnes que vols observar tu. Si no marques ningú, podràs veure tota la classe.</p>
          <div id="students-for-session" class="list"><p class="muted">Carregant alumnes...</p></div>
        </div>
        <div class="toolbar form-actions"><button id="create-session-button">Crear sessió</button><button type="button" class="ghost" onclick="go('home')">Cancel·lar</button></div>
      </form>
      <div id="message" style="margin-top:12px"></div>
    </section>`;
}

function behaviorSelector(selectedCodes = []) {
  const selected = new Set(selectedCodes);
  return `<div class="behavior-selector">${(state.boot.skills || []).map((skill) => `
    <div class="skill-group" style="--skill-color:${skill.color}">
      <h3>${escapeHtml(skill.name)}</h3>
      <div class="behavior-options">
        ${(skill.behaviors || []).map((behavior) => `
          <button type="button" class="behavior-option ${selected.has(behavior.code) || selected.has(behavior.id) ? 'selected' : ''}" data-code="${behavior.code}" data-id="${behavior.id}" onclick="toggleBehavior(this)">
            <span class="pill">${escapeHtml(behavior.code)}</span>
            <span class="behavior-name">${escapeHtml(behavior.name)}</span>
          </button>`).join('')}
      </div>
    </div>`).join('')}</div>`;
}

function editSessionView() {
  const details = state.selectedSession;
  if (!details) return '<section class="card"><h2>Editar sessió</h2><p class="muted">Carregant la sessió...</p></section>';

  const session = details.session;
  const hasEvaluations = Number(session.evaluationsCount || 0) > 0;
  const cycles = (state.boot.cycles || []).filter((cycle) => cycle.status === 'active');
  const selectedCodes = (details.behaviors || []).map((behavior) => behavior.code);
  const selectedStudents = new Set(details.heteroStudentIds || []);
  const sessionDate = session.sessionDate || '';

  return `
    <section class="form-page session-page">
      <div class="form-hero">
        <div>
          <span class="section-kicker">Configuració</span>
          <h2>Editar sessió</h2>
          <p>${hasEvaluations ? 'Aquesta sessió ja té valoracions. Només es pot canviar el nom.' : 'Pots ajustar cicle, comportaments i alumnat abans de recollir valoracions.'}</p>
        </div>
        <div class="hero-media" aria-hidden="true"><img src="assets/pentabilities-logo.png" alt=""></div>
      </div>
      <form class="visual-form" onsubmit="saveEditedSession(event)">
        ${hasEvaluations ? `<div class="notice warning">Aquesta sessió té ${session.evaluationsCount} valoracions. Si guardes el canvi, s'esborraran les valoracions existents i només es modificarà el nom.</div>` : ''}
        <div class="form-section">
          <h3>Dades de la sessió</h3>
          <div class="grid two">
            ${hasEvaluations ? '' : `<label class="field-card">Cicle<select name="cycleId">${cycles.map((c) => `<option value="${c.id}" ${c.id === session.cycleId ? 'selected' : ''}>${escapeHtml(c.name)} / ${escapeHtml(formatClassGroup(c.classGroup))}</option>`).join('')}</select></label>`}
            <label class="field-card">Nom de la sessió<input name="name" required value="${escapeHtml(session.name)}"></label>
            ${hasEvaluations ? '' : `<label class="field-card">Data<input name="sessionDate" type="date" value="${escapeHtml(sessionDate)}"></label>
            <label class="field-card">Estat<select name="openNow"><option value="true" ${session.status === 'open' ? 'selected' : ''}>Oberta</option><option value="false" ${session.status !== 'open' ? 'selected' : ''}>Esborrany</option></select></label>`}
          </div>
        </div>
        ${hasEvaluations ? '' : `
          <div class="form-section behavior-section">
            <div class="section-heading">
              <div>
                <h3>Comportaments</h3>
                <p class="muted">Modifica només el que encara no s'ha avaluat.</p>
              </div>
              <span class="selection-status"><span id="behavior-count">${selectedCodes.length}</span> seleccionats</span>
            </div>
            ${behaviorSelector(selectedCodes)}
          </div>
          <div class="form-section students-section">
            <h3>Alumnes per a avaluació del professorat</h3>
            <p class="muted">Marca els alumnes que vols observar. Després podràs mostrar tota la classe si cal.</p>
            <div class="list">${studentsCheckboxGrid(details.students || [], selectedStudents)}</div>
          </div>`}
        <div class="toolbar form-actions"><button id="save-session-button">Guardar canvis</button><button type="button" class="ghost" onclick="go('home')">Cancel·lar</button></div>
      </form>
      <div id="message" style="margin-top:12px"></div>
    </section>`;
}

function getHomeStatsForDisplay() {
  if (state.homeStats) return state.homeStats;
  if (!hasGoogleApi && !hasSupabaseConfig) return previewHomeStats();
  return {
    evaluatedStudents: PREVIEW.students.length,
    evaluatedBehaviors: PREVIEW.skills.reduce((total, skill) => total + (skill.behaviors || []).length, 0)
  };
}

async function loadHomeStats() {
  if (state.homeStatsLoading) return;
  state.homeStatsLoading = true;
  try {
    const stats = useSupabase
      ? await rpc('teacher_home_stats')
      : hasGoogleApi
        ? await api('teacher_home_stats')
        : previewHomeStats();
    state.homeStats = normalizeHomeStats(stats);
    updateHomeStatsTiles(state.homeStats);
  } catch (error) {
    // Manté els números anteriors si el backend encara no té aquesta funció.
  } finally {
    state.homeStatsLoading = false;
  }
}

function normalizeHomeStats(stats) {
  return {
    evaluatedStudents: Number(stats?.evaluatedStudents ?? stats?.evaluated_students ?? 0),
    evaluatedBehaviors: Number(stats?.evaluatedBehaviors ?? stats?.evaluated_behaviors ?? 0)
  };
}

function updateHomeStatsTiles(stats) {
  const students = document.querySelector('#home-evaluated-students');
  const behaviors = document.querySelector('#home-evaluated-behaviors');
  if (students) students.textContent = String(stats.evaluatedStudents);
  if (behaviors) behaviors.textContent = String(stats.evaluatedBehaviors);
}

function sessionCreatedView() {
  const details = state.enteredSession || state.selectedSession;
  const session = state.projectedSession || details?.session;
  if (!session) return homeView();
  return `
    <section class="session-created-screen">
      <div class="session-created-content">
        <h2>Sessió creada</h2>
        <span class="row-title">${escapeHtml(session.name)}</span>
        <div class="row-meta">${escapeHtml(formatClassGroup(session.classGroup))} · ${statusLabel(session.status)}</div>
        <p class="muted" style="margin-top:10px">Codi per projectar a l'aula</p>
        <button class="code-box code-button large-inline-code" onclick="projectCodeFromBoot('${session.id}')">${escapeHtml(session.accessCode)}</button>
        <div class="toolbar" style="margin-top:12px">
          <button onclick="projectCodeFromBoot('${session.id}')">Projectar codi</button>
          <button onclick="loadTeacherEvaluation('${session.id}')">Avaluar</button>
          <button class="ghost" onclick="go('home')">Tornar al panell</button>
        </div>
      </div>
    </section>`;
}

function studentSessionView() {
  const details = state.enteredSession;
  const currentStudentId = state.boot.user.id;
  const currentStudent = details.students.find((student) => student.id === currentStudentId) || details.students[0];
  const classmates = details.students.filter((student) => student.id !== currentStudent.id);

  return `
    <section class="card">
      <div class="section-heading evaluation-heading">
        <div>
          <h2>${escapeHtml(details.session.name)}</h2>
          <p class="muted">${escapeHtml(details.cycle.name)} · ${escapeHtml(formatClassGroup(details.session.classGroup))}</p>
        </div>
        <span class="selection-status">${details.behaviors.length} comportaments</span>
      </div>
      <div class="step-title"><span>1</span><strong>Autoavaluació</strong></div>
      ${studentRatingCards([currentStudent], details.behaviors, 'self-evaluation-grid')}
      <div class="step-title"><span>2</span><strong>Companys amb qui has treballat</strong></div>
      ${studentRatingCards(classmates, details.behaviors)}
      <div class="toolbar sticky-actions"><button onclick="submitStudentRatings()">Enviar valoracions</button><button class="secondary" onclick="go('home')">Revisar després</button></div>
      <div id="message" style="margin-top:12px"></div>
    </section>`;
}

function teacherEvaluationView() {
  const details = state.selectedSession;
  const selected = new Set(details.heteroStudentIds || []);
  const initialStudents = selected.size ? details.students.filter((student) => selected.has(student.id)) : details.students;
  const toggleButton = selected.size
    ? '<button id="teacher-student-toggle" class="secondary" onclick="showAllTeacherStudents()">Mostrar tota la classe</button>'
    : '';

  return `
    <section class="card">
      <div class="section-heading evaluation-heading">
        <div>
          <h2>Avaluar</h2>
          <p class="muted">${escapeHtml(details.session.name)} · ${escapeHtml(formatClassGroup(details.session.classGroup))}</p>
        </div>
        <div class="toolbar">${toggleButton}</div>
      </div>
      <div class="student-tools"><input type="search" placeholder="Cercar alumne" oninput="filterStudentCards(this.value, 'teacher-students')"></div>
      <div id="teacher-students">${studentRatingCards(initialStudents, details.behaviors)}</div>
      <div class="toolbar sticky-actions"><button onclick="submitTeacherRatings()">Enviar valoracions</button><button class="secondary" onclick="go('home')">Tornar</button></div>
      <div id="message" style="margin-top:12px"></div>
    </section>`;
}

function studentRatingCards(students, behaviors, extraClass = '') {
  return `<div class="student-grid ${extraClass}">${students.map((student) => `
    <div class="student-row" data-student-id="${student.id}" data-search="${escapeHtml(normalize(student.name))}">
      <div class="student-name">${escapeHtml(student.name)}</div>
      <div class="ratings-table">${behaviors.map((behavior) => `
        <div class="rating-line">
          <span class="rating-label"><span class="pill">${escapeHtml(behavior.code)}</span> ${escapeHtml(behavior.name)}</span>
          ${stars(student.id, behavior.id)}
        </div>`).join('')}</div>
    </div>`).join('')}</div>`;
}

function stars(studentId, behaviorId) {
  return `<span class="stars" data-student="${studentId}" data-behavior="${behaviorId}">
    ${[1, 2, 3, 4, 5].map((value) => `<button type="button" class="star ${Number(state.ratings[`${studentId}|${behaviorId}`]?.value || 0) >= value ? 'on' : ''}" aria-label="${value}" onclick="setRating('${studentId}','${behaviorId}',${value}, this)">★</button>`).join('')}
  </span>`;
}

function projectCodeView() {
  const details = state.projectedSession;
  if (!details) return homeView();
  return `
    <section class="project-screen">
      <div class="project-brand">
        <img src="assets/pentabilities-logo.png" alt="Pentabilities">
        <img src="assets/ramon-pont.png" alt="Escola Ramon Pont">
      </div>
      <div class="project-session">${escapeHtml(details.name)}</div>
      <div class="project-code">${escapeHtml(details.accessCode)}</div>
      <div class="project-meta">${escapeHtml(formatClassGroup(details.classGroup))} · ${statusLabel(details.status)}</div>
      <div class="toolbar project-toolbar"><button onclick="go('home')">Tornar</button><button class="secondary" onclick="copyCode('${details.accessCode}')">Copiar codi</button></div>
    </section>`;
}

function dashboardView() {
  const dashboard = state.dashboard || {};
  const skills = dashboard.bySkill || [];
  const behaviors = dashboard.byBehavior || [];
  const students = dashboard.byStudent || [];
  const studentsWithData = students.filter((item) => Number(item.count) > 0).sort(compareDashboardStudents);
  const topBehaviors = behaviors.filter((item) => Number(item.count) > 0).sort((a, b) => Number(b.average) - Number(a.average)).slice(0, 5);
  const lowBehaviors = behaviors.filter((item) => Number(item.count) > 0).sort((a, b) => Number(a.average) - Number(b.average)).slice(0, 5);
  const lowStudents = [...studentsWithData].sort((a, b) => Number(a.average) - Number(b.average)).slice(0, 6);
  const countMax = Math.max(...(dashboard.distribution || []).map((item) => Number(item.count)), 1);

  return `
    <section class="cycle-dashboard">
      <div class="dashboard-title">
        <div>
          <span class="section-kicker">Dashboard de cicle</span>
          <h2>${escapeHtml(dashboard.cycle?.name || 'Resultats del cicle')}</h2>
          <p class="muted">${escapeHtml(formatClassGroup(dashboard.cycle?.classGroup || ''))}</p>
        </div>
        <div class="toolbar"><button class="ghost" onclick="go('home')">Tornar</button></div>
      </div>

      <div class="dashboard-summary">
        ${compactMetric('Mitjana global', score(dashboard.globalAverage), '/5')}
        ${compactMetric('Sessions', dashboard.sessionsCount ?? '-', '')}
        ${compactMetric('Alumnes amb resposta', `${dashboard.respondents ?? 0}/${dashboard.totalStudents ?? '-'}`, '')}
        ${compactMetric('Valoracions', dashboard.evaluationsCount ?? 0, '')}
      </div>

      <section class="dashboard-main">
        <div class="dashboard-panel radar-panel">
          <div class="section-heading">
            <div>
              <h3>Radar d'habilitats</h3>
              <p class="muted">Mitjana del cicle i comparativa entre autoavaluació, coavaluació i heteroavaluació.</p>
            </div>
          </div>
          <div class="radar-layout integrated-radar-layout">
            ${radarChart(skills, {
              title: 'Habilitats per tipus d’avaluació',
              featured: true,
              series: [
                { key: 'self', label: 'Autoavaluació', color: '#e9b44c' },
                { key: 'peer', label: 'Coavaluació', color: '#238457' },
                { key: 'teacher', label: 'Heteroavaluació', color: '#c44f6d' }
              ]
            })}
            <div class="radar-small-grid under-main-radar">
              ${typeRadar('Autoavaluació', skills, 'self', '#e9b44c')}
              ${typeRadar('Coavaluació', skills, 'peer', '#238457')}
              ${typeRadar('Heteroavaluació', skills, 'teacher', '#c44f6d')}
            </div>
          </div>
        </div>

        <div class="dashboard-panel">
          <h3>Lectura ràpida</h3>
          <div class="insight-grid">
            ${insightCard('Millor resultat', topBehaviors[0], 'fort')}
            ${insightCard('Prioritat de treball', lowBehaviors[0], 'millora')}
            ${insightText('Alumnat amb dades', studentsWithData.length ? `${studentsWithData.length} alumnes amb valoracions` : 'Encara no hi ha prou dades')}
            ${insightText('Seguiment', lowStudents.length ? `${lowStudents.length} alumnes a revisar individualment` : 'Encara no hi ha prou dades')}
          </div>
          <div class="distribution-compact">
            ${(dashboard.distribution || []).map((item) => `
              <div class="distribution-item">
                <span>${item.value}★</span>
                <div class="bar"><span style="width:${Math.min(100, Number(item.count) / countMax * 100)}%"></span></div>
                <strong>${item.count}</strong>
              </div>`).join('')}
          </div>
          <div class="behavior-ranking">
            <h4>Rànquing de comportaments</h4>
            ${(behaviors.filter((item) => Number(item.count) > 0).sort((a, b) => Number(b.average) - Number(a.average)).slice(0, 8)).map(behaviorRankingRow).join('') || emptyDashboard()}
          </div>
        </div>
      </section>

      <section class="dashboard-grid">
        <div class="dashboard-panel">
          <h3>Habilitats</h3>
          <div class="skill-results">${skills.map(skillResultRow).join('') || emptyDashboard()}</div>
        </div>
        <div class="dashboard-panel student-lookup-panel">
          <h3>Consulta individual</h3>
          <p class="muted">Opcional. Tria un alumne només quan vulguis fer feedback individual.</p>
          <label class="compact-select">Alumne
            <select onchange="showStudentDashboard(this.value)">
              <option value="">Selecciona un alumne</option>
              ${studentsWithData.map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`).join('')}
            </select>
          </label>
          <div id="student-dashboard-detail" class="student-dashboard-detail"></div>
        </div>
      </section>

      <section class="dashboard-panel behavior-dashboard-panel">
        <div class="section-heading">
          <div>
            <h3>Comportaments per habilitat</h3>
            <p class="muted">Cada radar mostra els comportaments d'una habilitat. Les barres comparen autoavaluació, coavaluació i heteroavaluació.</p>
          </div>
        </div>
        <div class="behavior-radar-grid">
          ${skills.map((skill) => behaviorSkillPanel(skill, behaviors.filter((item) => item.skillKey === skill.key))).join('')}
        </div>
      </section>
    </section>
    `;
}

function compactMetric(label, value, suffix) {
  return `
    <div class="dash-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}<small>${escapeHtml(suffix || '')}</small></strong>
    </div>`;
}

function score(value) {
  const number = Number(value || 0);
  return number ? number.toFixed(2).replace(/\.00$/, '') : '0';
}

function emptyDashboard() {
  return '<p class="muted">Encara no hi ha dades.</p>';
}

function radarChart(items, options = {}) {
  const series = options.series || [{ key: 'average', label: 'Mitjana', color: '#1f6f8b' }];
  const values = items.length ? items : [{ key: '-', label: '-', average: 0 }];
  const size = options.modal ? 640 : options.featured ? 900 : options.small ? 150 : 260;
  const center = size / 2;
  const radius = options.modal ? 220 : options.featured ? 360 : options.small ? 48 : 86;
  const levels = [1, 2, 3, 4, 5];
  const axes = values.map((item, index) => radarPoint(index, values.length, radius, center, 5));
  const polygons = series.map((entry) => {
    const points = values.map((item, index) => radarPoint(index, values.length, radius, center, Number(item[entry.key] || 0))).join(' ');
    return `<polygon points="${points}" fill="${entry.color}" fill-opacity="${options.small ? '.18' : '.14'}" stroke="${entry.color}" stroke-width="${options.small ? 2 : 3}"></polygon>`;
  }).join('');
  const labels = values.map((item, index) => {
    const point = radarPoint(index, values.length, radius + (options.small ? 16 : 26), center, 5).split(',');
    return `<text x="${point[0]}" y="${point[1]}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(item.key || item.label || '')}</text>`;
  }).join('');

  const className = `radar-chart ${options.modal ? 'modal-radar' : ''} ${options.featured ? 'featured' : ''} ${options.small ? 'small' : ''}`;
  const openAction = options.modal ? '' : ` onclick='openRadarPopup(${escapeHtml(JSON.stringify({ items: values, options: { ...options, small: false, featured: false } }))})' title="Ampliar radar"`;
  const tag = options.modal ? 'div' : 'button type="button"';
  return `
    <${tag} class="${className}"${openAction}>
      <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeHtml(options.title || 'Radar')}">
        ${levels.map((level) => `<polygon class="radar-grid-line" points="${values.map((_, index) => radarPoint(index, values.length, radius, center, level)).join(' ')}"></polygon>`).join('')}
        ${axes.map((point) => `<line class="radar-axis" x1="${center}" y1="${center}" x2="${point.split(',')[0]}" y2="${point.split(',')[1]}"></line>`).join('')}
        ${levels.map((level) => `<text class="radar-scale-label" x="${center + 6}" y="${(center - radius * level / 5).toFixed(2)}">${level}</text>`).join('')}
        ${polygons}
        ${labels}
      </svg>
      ${series.length > 1 ? `<div class="radar-legend">${series.map((entry) => `<span><i style="background:${entry.color}"></i>${escapeHtml(entry.label)}</span>`).join('')}</div>` : ''}
    </${options.modal ? 'div' : 'button'}>`;
}

function openRadarPopup(payload) {
  const existing = document.querySelector('#radar-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'radar-modal';
  modal.className = 'radar-modal';
  modal.innerHTML = `
    <div class="radar-modal-backdrop" onclick="closeRadarPopup()"></div>
    <div class="radar-modal-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(payload.options?.title || 'Radar ampliat')}">
      <div class="radar-modal-head">
        <h3>${escapeHtml(payload.options?.title || 'Radar ampliat')}</h3>
        <button class="ghost radar-modal-close" onclick="closeRadarPopup()" aria-label="Tancar">×</button>
      </div>
      ${radarChart(payload.items || [], { ...(payload.options || {}), modal: true, small: false, featured: false })}
    </div>`;
  document.body.appendChild(modal);
}

function closeRadarPopup() {
  document.querySelector('#radar-modal')?.remove();
}

function radarPoint(index, total, radius, center, value) {
  const angle = (Math.PI * 2 * index / total) - Math.PI / 2;
  const normalized = Math.max(0, Math.min(5, Number(value || 0))) / 5;
  const x = center + Math.cos(angle) * radius * normalized;
  const y = center + Math.sin(angle) * radius * normalized;
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

function typeRadar(title, skills, key, color) {
  return `
    <div class="mini-radar-card">
      <strong>${escapeHtml(title)}</strong>
      ${radarChart(skills, { title, small: true, series: [{ key, label: title, color }] })}
    </div>`;
}

function insightCard(title, item, kind) {
  if (!item) return insightText(title, 'Encara no hi ha prou dades');
  return `
    <div class="insight-card ${kind}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(item.key)} · ${score(item.average)}</strong>
      <small>${escapeHtml(item.label || '')}</small>
    </div>`;
}

function insightText(title, text) {
  return `<div class="insight-card"><span>${escapeHtml(title)}</span><strong>${escapeHtml(text)}</strong></div>`;
}

function behaviorRankingRow(item) {
  const value = Math.max(0, Math.min(5, Number(item.average || 0)));
  return `
    <div class="ranking-row">
      <div class="ranking-label"><strong>${escapeHtml(item.key)}</strong><span>${escapeHtml(item.label || '')}</span></div>
      <div class="ranking-bar"><span style="width:${value / 5 * 100}%"></span></div>
      <b>${score(value)}</b>
    </div>`;
}

function skillResultRow(skill) {
  return `
    <div class="result-row" style="--row-color:${skill.color || '#1f6f8b'}">
      <div><strong>${escapeHtml(skill.label || skill.key)}</strong><span>${skill.count || 0} valoracions</span></div>
      <div class="score-pill">${score(skill.average)}</div>
      <div class="triple-bars">
        ${miniBar('Auto', skill.self, '#e9b44c')}
        ${miniBar('Co', skill.peer, '#238457')}
        ${miniBar('Hetero', skill.teacher, '#c44f6d')}
      </div>
    </div>`;
}

function studentResultRow(student) {
  const delta = Number(student.delta || 0);
  return `
    <div class="student-result-row">
      <div><strong>${escapeHtml(student.name)}</strong><span>${student.count || 0} valoracions</span></div>
      <div class="student-score ${delta < 0 ? 'below' : 'above'}">${score(student.average)}<small>${delta >= 0 ? '+' : ''}${score(delta)}</small></div>
    </div>`;
}

function compareDashboardStudents(a, b) {
  return sortableStudentName(a.name).localeCompare(sortableStudentName(b.name), 'ca', { sensitivity: 'base' });
}

function sortableStudentName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || '';
  return `${parts.slice(1).join(' ')} ${parts[0]}`;
}

function showStudentDashboard(studentId) {
  const box = document.querySelector('#student-dashboard-detail');
  if (!box) return;
  if (!studentId) {
    box.innerHTML = '';
    return;
  }
  const dashboard = state.dashboard || {};
  const student = (dashboard.byStudent || []).find((item) => item.id === studentId);
  const skills = (dashboard.byStudentSkill || []).filter((item) => item.studentId === studentId)
    .map((item) => ({ ...item, key: item.skillKey }));
  if (!student) {
    box.innerHTML = emptyDashboard();
    return;
  }
  box.innerHTML = `
    <div class="student-detail-card">
      <div class="student-detail-head">
        <div>
          <strong>${escapeHtml(student.name)}</strong>
          <span>${student.count || 0} valoracions · mitjana ${score(student.average)}/5</span>
        </div>
        <div class="student-score ${Number(student.delta || 0) < 0 ? 'below' : 'above'}">${score(student.average)}<small>${Number(student.delta || 0) >= 0 ? '+' : ''}${score(student.delta)}</small></div>
      </div>
      ${radarChart(skills, { title: `Radar de ${student.name}`, small: true, series: [{ key: 'average', label: 'Mitjana', color: '#1f6f8b' }] })}
      <div class="triple-bars">
        ${miniBar('Auto', student.self, '#e9b44c')}
        ${miniBar('Co', student.peer, '#238457')}
        ${miniBar('Hetero', student.teacher, '#c44f6d')}
      </div>
    </div>`;
}

function behaviorSkillPanel(skill, behaviors) {
  const rows = behaviors.filter((item) => Number(item.count) > 0);
  return `
    <div class="behavior-skill-panel" style="--skill-color:${skill.color || '#1f6f8b'}">
      <div class="section-heading compact">
        <h4>${escapeHtml(skill.label || skill.key)}</h4>
        <span class="score-pill">${score(skill.average)}</span>
      </div>
      ${radarChart(rows.length ? rows : behaviors.slice(0, 5), { title: skill.label, small: true, series: [{ key: 'average', label: 'Mitjana', color: skill.color || '#1f6f8b' }] })}
      <div class="behavior-mini-list">
        ${(rows.length ? rows : behaviors.slice(0, 4)).map((behavior) => `
          <div>
            <div class="behavior-row"><span>${escapeHtml(behavior.key)} · ${escapeHtml(behavior.label)}</span><strong>${score(behavior.average)}</strong></div>
            <div class="triple-bars">
              ${miniBar('Auto', behavior.self, '#e9b44c')}
              ${miniBar('Co', behavior.peer, '#238457')}
              ${miniBar('Hetero', behavior.teacher, '#c44f6d')}
            </div>
          </div>`).join('') || emptyDashboard()}
      </div>
    </div>`;
}

function miniBar(label, value, color) {
  const width = Math.max(0, Math.min(100, Number(value || 0) / 5 * 100));
  return `<span class="mini-bar"><em>${escapeHtml(label)}</em><i><b style="width:${width}%;background:${color}"></b></i><strong>${score(value)}</strong></span>`;
}

async function loginWithGoogle() {
  const button = document.querySelector('#login-button');
  setButtonLoading(button, 'Connectant amb Google...');
  state.authError = '';

  try {
    if (!db) throw new Error('No s’ha pogut carregar el servei d’autenticació.');
    const redirectUrl = new URL(window.location.href);
    redirectUrl.search = '';
    redirectUrl.hash = '';
    const hostedDomain = String(config.googleHostedDomain || 'ramonpont.cat').trim();
    const queryParams = { prompt: 'select_account' };
    if (hostedDomain) queryParams.hd = hostedDomain;

    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl.toString(),
        queryParams
      }
    });
    if (error) throw error;
  } catch (error) {
    state.authError = authErrorMessage(error);
    showMessage(state.authError, 'error');
    resetButton(button, 'Inicia la sessió amb Google');
  }
}

async function logout() {
  if (db) {
    try {
      await db.auth.signOut();
    } catch (error) {
      // La interfície també es tanca si el navegador queda temporalment fora de línia.
    }
    state.authSession = null;
    state.authError = '';
  }
  safeStorageRemove('pentabilities:token');
  state.boot = { needsLogin: true };
  state.ratings = {};
  render();
}

function go(view) {
  state.view = view;
  state.ratings = {};
  render();
}

function selectCycle(id) {
  state.selectedCycleId = id;
  state.view = 'newSession';
  render();
}

function toggleBehavior(button) {
  button.classList.toggle('selected');
  updateBehaviorCount();
}

function updateBehaviorCount() {
  const count = document.querySelectorAll('.behavior-option.selected').length;
  const box = document.querySelector('#behavior-count');
  if (box) box.textContent = String(count);
}

function setRating(studentId, behaviorId, value, button) {
  state.ratings[`${studentId}|${behaviorId}`] = { evaluatedId: studentId, behaviorId, value };
  [...button.parentElement.children].forEach((star, index) => star.classList.toggle('on', index < value));
}

function triggerRosterSyncBackground() {
  if (!useSupabase || !hasGoogleApi) return;
  api('sync_roster_to_supabase').catch(() => {
    // La sincronització de roster no ha de bloquejar l'ús de l'app.
  });
}

function hydrateRatings(details) {
  state.ratings = {};
  (details.existingRatings || []).forEach((rating) => {
    const studentId = rating.evaluatedId || rating.avaluat_id;
    const behaviorId = rating.behaviorId || rating.codi_comportament;
    if (studentId && behaviorId) {
      state.ratings[`${studentId}|${behaviorId}`] = { evaluatedId: studentId, behaviorId, value: Number(rating.value) };
    }
  });
}

async function refreshBoot() {
  if (hasSupabaseConfig) {
    state.boot = await rpc('app_bootstrap');
  } else {
    throw new Error('Supabase Auth no està disponible.');
  }
}

function authErrorMessage(error) {
  const message = String(error?.message || '').trim();
  const normalized = message.toLowerCase();
  if (normalized.includes('not authorized') || normalized.includes('no està autoritzat') || normalized.includes('no està vinculat')) {
    return 'Aquest compte de Google no està autoritzat per entrar a Pentabilities.';
  }
  if (normalized.includes('oauth') || normalized.includes('provider')) {
    return 'No s’ha pogut iniciar la sessió amb Google. Torna-ho a provar.';
  }
  return message || 'No s’ha pogut iniciar la sessió.';
}

async function saveCycle(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  await action(async () => {
    if (!useSupabase && hasGoogleApi) {
      state.boot = await api('create_cycle', data);
    } else if (hasSupabaseConfig) {
      state.boot = await rpc('create_cycle', { p_data: data });
    } else {
      const cycle = {
        id: `cycle-${Date.now()}`,
        name: data.name,
        classGroup: data.classGroup,
        status: 'active'
      };
      state.boot.cycles = [cycle, ...(state.boot.cycles || [])];
      PREVIEW.cycles = [cycle, ...PREVIEW.cycles];
      savePreviewData();
    }
    state.view = 'home';
    render();
  }, 'Cicle creat correctament.');
}

async function saveSession(event) {
  event.preventDefault();
  const form = event.target;
  const button = document.querySelector('#create-session-button');
  const data = Object.fromEntries(new FormData(form).entries());
  data.openNow = data.openNow === 'true';
  data.behaviorCodes = [...form.querySelectorAll('.behavior-option.selected')].map((item) => item.dataset.code);
  data.studentIds = [...form.querySelectorAll('[name="heteroStudent"]:checked')].map((input) => input.value);

  if (!data.name || !data.name.trim()) {
    showMessage('Cal escriure el nom de la sessió.', 'error');
    return;
  }
  if (!data.behaviorCodes.length) {
    showMessage('Cal seleccionar almenys un comportament.', 'error');
    return;
  }

  setButtonLoading(button, 'Creant...');
  await action(async () => {
    const details = useSupabase
      ? await rpc('create_session', { p_data: data })
      : hasGoogleApi
        ? await api('create_session', data)
        : createPreviewSession(data);
    await refreshBoot();
    state.selectedSession = details;
    state.enteredSession = details;
    state.projectedSession = details.session;
    state.view = 'sessionCreated';
    render();
  });
  resetButton(button, 'Crear sessió');
}

async function loadStudentsForCycle() {
  const cycle = (state.boot.cycles || []).find((c) => c.id === state.selectedCycleId) || (state.boot.cycles || [])[0];
  const box = document.querySelector('#students-for-session');
  if (!cycle || !box) return;
  try {
    const students = useSupabase
      ? await rpc('students_by_class', { p_class_group: cycle.classGroup })
      : hasGoogleApi
        ? await api('students_by_class', { classGroup: cycle.classGroup })
        : PREVIEW.students;
    box.innerHTML = studentsCheckboxGrid(students);
  } catch (error) {
    box.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
  }
}

function studentsCheckboxGrid(students, selectedStudents = new Set()) {
  return `<div class="students-check-grid">${students.map((student) => `
    <label class="student-check-row"><span>${escapeHtml(student.name)}</span><input type="checkbox" name="heteroStudent" value="${student.id}" ${selectedStudents.has(student.id) ? 'checked' : ''}></label>`).join('')}</div>`;
}

async function enterStudentCode() {
  const input = document.querySelector('#session-code');
  await action(async () => {
    state.enteredSession = useSupabase
      ? await rpc('session_by_code', { p_code: input.value })
      : hasGoogleApi
        ? await api('session_by_code', { code: input.value })
        : previewSessionDetails();
    hydrateRatings(state.enteredSession);
    state.view = 'studentSession';
    render();
  });
}

async function submitStudentRatings() {
  const ratings = Object.values(state.ratings);
  await action(async () => {
    const result = useSupabase
      ? await rpc('submit_student_evaluations', {
        p_code: state.enteredSession.session.accessCode,
        p_ratings: ratings
      })
      : hasGoogleApi
        ? await api('submit_student_evaluations', { code: state.enteredSession.session.accessCode, ratings })
        : { saved: ratings.length };
    if (!hasGoogleApi && !hasSupabaseConfig) savePreviewRatings(state.enteredSession.session.id, state.boot.user.id, state.boot.user.role, ratings);
    showMessage(`Valoracions enviades correctament: ${result.saved}.`, 'success');
  });
}

async function loadTeacherEvaluation(sessionId) {
  await action(async () => {
    state.selectedSession = useSupabase
      ? await rpc('session_details', { p_session_id: sessionId })
      : hasGoogleApi
        ? await api('session_details', { sessionId })
        : previewSessionDetails(sessionId);
    hydrateRatings(state.selectedSession);
    state.view = 'teacherEvaluation';
    render();
  });
}

function showAllTeacherStudents() {
  const details = state.selectedSession;
  const box = document.querySelector('#teacher-students');
  if (box) box.innerHTML = studentRatingCards(details.students, details.behaviors);
  const button = document.querySelector('#teacher-student-toggle');
  if (button) {
    button.textContent = 'Mostrar només els alumnes seleccionats';
    button.setAttribute('onclick', 'showSelectedTeacherStudents()');
  }
}

function showSelectedTeacherStudents() {
  const details = state.selectedSession;
  const selected = new Set(details.heteroStudentIds || []);
  const students = selected.size ? details.students.filter((student) => selected.has(student.id)) : details.students;
  const box = document.querySelector('#teacher-students');
  if (box) box.innerHTML = studentRatingCards(students, details.behaviors);
  const button = document.querySelector('#teacher-student-toggle');
  if (button) {
    button.textContent = 'Mostrar tota la classe';
    button.setAttribute('onclick', 'showAllTeacherStudents()');
  }
}

async function submitTeacherRatings() {
  const ratings = Object.values(state.ratings);
  await action(async () => {
    const result = useSupabase
      ? await rpc('submit_teacher_evaluations', {
        p_session_id: state.selectedSession.session.id,
        p_ratings: ratings
      })
      : hasGoogleApi
        ? await api('submit_teacher_evaluations', { sessionId: state.selectedSession.session.id, ratings })
        : { saved: ratings.length };
    if (!hasGoogleApi && !hasSupabaseConfig) savePreviewRatings(state.selectedSession.session.id, state.boot.user.id, state.boot.user.role, ratings);
    showMessage(`Valoracions enviades correctament: ${result.saved}.`, 'success');
  });
}

async function showSessionDashboard(sessionId) {
  await action(async () => {
    state.dashboard = useSupabase
      ? await rpc('session_dashboard', { p_session_id: sessionId })
      : hasGoogleApi
        ? await api('session_dashboard', { sessionId })
        : previewDashboard();
    state.view = 'dashboard';
    render();
  });
}

async function editSession(sessionId) {
  await action(async () => {
    state.selectedSession = useSupabase
      ? await rpc('session_details', { p_session_id: sessionId })
      : hasGoogleApi
        ? await api('session_details', { sessionId })
        : previewSessionDetails(sessionId);
    state.view = 'editSession';
    render();
  });
}

async function saveEditedSession(event) {
  event.preventDefault();
  const form = event.target;
  const button = document.querySelector('#save-session-button');
  const session = state.selectedSession?.session;
  if (!session) return;

  const hasEvaluations = Number(session.evaluationsCount || 0) > 0;
  const data = Object.fromEntries(new FormData(form).entries());
  data.openNow = data.openNow === 'true';
  data.behaviorCodes = [...form.querySelectorAll('.behavior-option.selected')].map((item) => item.dataset.code);
  data.studentIds = [...form.querySelectorAll('[name="heteroStudent"]:checked')].map((input) => input.value);

  if (!data.name || !data.name.trim()) {
    showMessage('Cal escriure el nom de la sessió.', 'error');
    return;
  }
  if (!hasEvaluations && !data.behaviorCodes.length) {
    showMessage('Cal seleccionar almenys un comportament.', 'error');
    return;
  }
  if (hasEvaluations) {
    const confirmed = confirm('Aquesta sessió ja té valoracions. Si continues, s’esborraran totes les valoracions i només es canviarà el nom. Vols continuar?');
    if (!confirmed) return;
    data.clearEvaluations = true;
  }

  setButtonLoading(button, 'Guardant...');
  await action(async () => {
    const details = useSupabase
      ? await rpc('update_session', { p_session_id: session.id, p_data: data })
      : hasGoogleApi
        ? await api('update_session', { sessionId: session.id, data })
        : updatePreviewSession(session.id, data);
    await refreshBoot();
    state.selectedSession = details;
    state.view = 'home';
    render();
  }, 'Sessió actualitzada.');
  resetButton(button, 'Guardar canvis');
}

async function duplicateSession(sessionId) {
  await action(async () => {
    const source = (state.boot.activeSessions || []).find((session) => session.id === sessionId);
    const name = source ? `Còpia de ${source.name}` : null;
    const details = useSupabase
      ? await rpc('duplicate_session', { p_session_id: sessionId, p_name: name })
      : hasGoogleApi
        ? await api('duplicate_session', { sessionId, name })
        : duplicatePreviewSession(sessionId, name);
    await refreshBoot();
    state.selectedSession = details;
    state.projectedSession = details.session;
    state.view = 'sessionCreated';
    render();
  }, 'Sessió duplicada. La còpia queda en esborrany i sense valoracions.');
}

async function deleteSession(sessionId) {
  const confirmed = confirm('Vols eliminar aquesta sessió? Aquesta acció esborrarà també les valoracions associades i no es pot desfer.');
  if (!confirmed) return;
  await action(async () => {
    if (useSupabase) state.boot = await rpc('delete_session', { p_session_id: sessionId });
    else if (hasGoogleApi) state.boot = await api('delete_session', { sessionId });
    else {
      PREVIEW.sessions = PREVIEW.sessions.filter((session) => session.id !== sessionId);
      savePreviewData();
      state.boot.activeSessions = PREVIEW.sessions;
    }
    state.view = 'home';
    render();
  }, 'Sessió eliminada.');
}

async function lockSession(sessionId) {
  await action(async () => {
    if (useSupabase) await rpc('lock_session', { p_session_id: sessionId });
    else if (hasGoogleApi) await api('lock_session', { sessionId });
    else {
      const session = PREVIEW.sessions.find((item) => item.id === sessionId);
      if (session) session.locked = true;
      savePreviewData();
    }
    await refreshBoot();
    state.view = 'home';
    render();
  }, 'Sessió bloquejada.');
}

async function unlockSession(sessionId) {
  await action(async () => {
    if (useSupabase) await rpc('unlock_session', { p_session_id: sessionId });
    else if (hasGoogleApi) await api('unlock_session', { sessionId });
    else {
      const session = PREVIEW.sessions.find((item) => item.id === sessionId);
      if (session) session.locked = false;
      savePreviewData();
    }
    await refreshBoot();
    state.view = 'home';
    render();
  }, 'Sessió desbloquejada.');
}

async function showCycleDashboard(cycleId) {
  await action(async () => {
    state.dashboard = useSupabase
      ? await rpc('cycle_dashboard', { p_cycle_id: cycleId })
      : hasGoogleApi
        ? await api('cycle_dashboard', { cycleId })
        : previewDashboard();
    state.view = 'dashboard';
    render();
  });
}

async function closeSession(sessionId) {
  await action(async () => {
    if (useSupabase) await rpc('close_session', { p_session_id: sessionId });
    else if (hasGoogleApi) await api('close_session', { sessionId });
    await refreshBoot();
    state.view = 'home';
    render();
  }, 'Sessió tancada.');
}

async function openSession(sessionId) {
  await action(async () => {
    if (useSupabase) await rpc('open_session', { p_session_id: sessionId });
    else if (hasGoogleApi) await api('open_session', { sessionId });
    await refreshBoot();
    state.view = 'home';
    render();
  }, 'Sessió oberta.');
}

function projectCodeFromBoot(sessionId) {
  const session = (state.boot.activeSessions || []).find((item) => item.id === sessionId) || state.projectedSession;
  if (!session) return;
  state.projectedSession = session;
  state.view = 'projectCode';
  render();
}

function copyCode(code) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code);
}

function filterStudentCards(value, containerId = '') {
  const root = containerId ? document.querySelector(`#${containerId}`) : document;
  filterStudentCardsIn(value, root || document);
}

function filterStudentCardsIn(value, root) {
  const needle = normalize(String(value || ''));
  (root || document).querySelectorAll('.student-row').forEach((row) => {
    const name = row.dataset.search || normalize(row.querySelector('.student-name')?.textContent || '');
    row.hidden = Boolean(needle && !name.includes(needle));
  });
}

async function action(fn, successMessage) {
  try {
    await fn();
    if (successMessage) showMessage(successMessage, 'success');
  } catch (error) {
    const normalized = String(error.message || '').toLowerCase();
    const isAuthFailure = normalized.includes('jwt')
      || normalized.includes('cal iniciar la sessió amb un compte')
      || normalized.includes('la sessió ha caducat')
      || normalized.includes('no està autoritzat')
      || normalized.includes('no està vinculat');
    if (useSupabase && isAuthFailure) {
      state.authError = authErrorMessage(error);
      await db.auth.signOut({ scope: 'local' });
      state.authSession = null;
      state.boot = { needsLogin: true };
      render();
      return;
    }
    showMessage(error.message, 'error');
  }
}

function showMessage(message, type = 'error') {
  const box = document.querySelector('#message');
  if (box) box.innerHTML = `<div class="notice ${type}">${escapeHtml(message)}</div>`;
}

function previewBoot(asTeacher, email = '') {
  const student = PREVIEW.students[0];
  const isTeacher = Boolean(asTeacher);
  return {
    token: 'preview',
    user: {
      id: isTeacher ? 'teacher-preview' : student.id,
      email: email || (isTeacher ? 'felip.sarroca@ramonpont.cat' : student.email),
      name: isTeacher ? 'Felip Sarroca' : student.name,
      role: isTeacher ? 'teacher' : 'student',
      classGroup: isTeacher ? '' : '4t dESO'
    },
    classes: ['1r dESO', '2n dESO', '3r dESO', '4t dESO'],
    skills: PREVIEW.skills,
    cycles: isTeacher ? PREVIEW.cycles : [],
    activeSessions: isTeacher ? PREVIEW.sessions : []
  };
}

function createPreviewSession(data) {
  const cycle = state.boot.cycles.find((item) => item.id === data.cycleId) || state.boot.cycles[0];
  const behaviors = PREVIEW.skills.flatMap((skill) => skill.behaviors).filter((behavior) => data.behaviorCodes.includes(behavior.code));
  const session = {
    id: `session-${Date.now()}`,
    cycleId: cycle.id,
    name: data.name.trim(),
    classGroup: cycle.classGroup,
    accessCode: String(Math.floor(100000 + Math.random() * 900000)),
    status: data.openNow ? 'open' : 'draft',
    behaviorCodes: data.behaviorCodes,
    heteroStudentIds: data.studentIds || [],
    progress: { totalStudents: PREVIEW.students.length, respondents: 0, pending: PREVIEW.students.length }
  };
  PREVIEW.sessions.unshift(session);
  savePreviewData();
  return {
    session,
    cycle,
    behaviors,
    students: PREVIEW.students,
    heteroStudentIds: session.heteroStudentIds,
    existingRatings: getPreviewRatings(session.id, state.boot.user.id, state.boot.user.role)
  };
}

function updatePreviewSession(sessionId, data) {
  const session = PREVIEW.sessions.find((item) => item.id === sessionId);
  if (!session) return createPreviewSession(data);
  session.name = data.name.trim();
  if (data.clearEvaluations) PREVIEW.ratings = (PREVIEW.ratings || []).filter((rating) => rating.sessionId !== sessionId);
  if (!data.clearEvaluations) {
    const cycle = PREVIEW.cycles.find((item) => item.id === data.cycleId) || PREVIEW.cycles.find((item) => item.id === session.cycleId);
    session.cycleId = cycle?.id || session.cycleId;
    session.sessionDate = data.sessionDate || '';
    session.status = data.openNow ? 'open' : 'draft';
    session.behaviorCodes = data.behaviorCodes || session.behaviorCodes || [];
    session.heteroStudentIds = data.studentIds || [];
  }
  savePreviewData();
  return previewSessionDetails(session.id);
}

function duplicatePreviewSession(sessionId, name) {
  const source = PREVIEW.sessions.find((item) => item.id === sessionId) || PREVIEW.sessions[0];
  const clone = {
    ...source,
    id: `session-${Date.now()}`,
    name: name || `Còpia de ${source.name}`,
    accessCode: String(Math.floor(100000 + Math.random() * 900000)),
    status: 'draft',
    locked: false,
    progress: { ...(source.progress || {}), respondents: 0, pending: source.progress?.totalStudents || PREVIEW.students.length, evaluationsCount: 0 }
  };
  PREVIEW.sessions.unshift(clone);
  savePreviewData();
  return previewSessionDetails(clone.id);
}

function previewSessionDetails(sessionId) {
  const session = PREVIEW.sessions.find((item) => item.id === sessionId) || PREVIEW.sessions[0];
  const cycle = PREVIEW.cycles.find((item) => item.id === session.cycleId) || PREVIEW.cycles[0];
  const behaviorCodes = session.behaviorCodes || ['R2', 'C1', 'C4', 'A1', 'G2', 'P4'];
  const behaviors = PREVIEW.skills.flatMap((skill) => skill.behaviors).filter((behavior) => behaviorCodes.includes(behavior.code));
  const evaluationsCount = (PREVIEW.ratings || []).filter((rating) => rating.sessionId === session.id).length;
  return {
    session: { ...session, evaluationsCount },
    cycle,
    behaviors,
    students: PREVIEW.students,
    heteroStudentIds: session.heteroStudentIds || PREVIEW.students.slice(0, 6).map((student) => student.id),
    evaluationsCount,
    existingRatings: getPreviewRatings(session.id, state.boot.user.id, state.boot.user.role)
  };
}

function previewDashboard() {
  return {
    respondents: 18,
    evaluationsCount: 126,
    globalAverage: 3.8,
    byBehavior: [
      { key: 'R2', label: 'R2 · Realitza les tasques de forma eficient', count: 24, average: 3.9 },
      { key: 'C1', label: 'C1 · Escolta els altres', count: 22, average: 4.1 },
      { key: 'C4', label: 'C4 · Participa en decisions consensuades', count: 20, average: 3.6 },
      { key: 'A1', label: 'A1 · Aporta idees', count: 18, average: 3.7 },
      { key: 'G2', label: 'G2 · Es mostra tranquil en situacions de pressió', count: 20, average: 3.8 },
      { key: 'P4', label: 'P4 · Fa bones preguntes', count: 22, average: 3.5 }
    ],
    byType: [
      { key: 'self', count: 18, average: 3.9 },
      { key: 'peer', count: 90, average: 3.7 },
      { key: 'teacher', count: 18, average: 4.0 }
    ],
    distribution: [
      { value: 1, count: 3 },
      { value: 2, count: 12 },
      { value: 3, count: 31 },
      { value: 4, count: 52 },
      { value: 5, count: 28 }
    ]
  };
}

function previewHomeStats() {
  const activeSessionIds = new Set(
    (PREVIEW.sessions || [])
      .filter((session) => session.status === 'open' || session.locked)
      .map((session) => session.id)
  );
  const ratings = (PREVIEW.ratings || []).filter((rating) => activeSessionIds.has(rating.sessionId));
  return {
    evaluatedStudents: new Set(ratings.map((rating) => rating.evaluatedId).filter(Boolean)).size,
    evaluatedBehaviors: new Set(ratings.map((rating) => rating.behaviorId).filter(Boolean)).size
  };
}

function buildPreviewData() {
  const skills = [
    skill('R', 'Responsabilitat', '#2f6fbd', [
      ['R1', 'Fa comentaris o activitats relacionats amb la tasca'],
      ['R2', 'Realitza les tasques de forma eficient'],
      ['R3', 'Realitza les tasques amb cura'],
      ['R4', 'Persevera davant les dificultats'],
      ['R5', 'Respecta les normes'],
      ['R6', 'Treballa de forma constant'],
      ['R7', 'Es manté connectat a l’activitat']
    ]),
    skill('C', 'Cooperació', '#238457', [
      ['C1', 'Escolta els altres'],
      ['C2', 'Incorpora el que diuen els altres'],
      ['C3', 'Fomenta la participació del grup'],
      ['C4', 'Participa en decisions consensuades'],
      ['C5', 'Facilita la resolució de conflictes'],
      ['C6', 'Reconeix responsabilitats pròpies i alienes'],
      ['C7', 'Ajuda els altres de forma desinteressada']
    ]),
    skill('A', 'Autonomia i iniciativa', '#c86a1f', [
      ['A1', 'Aporta idees'],
      ['A2', 'Fa preguntes quan s’encalla'],
      ['A3', 'Pren decisions per avançar'],
      ['A4', 'Sap convèncer el grup'],
      ['A5', 'Treballa amb determinació'],
      ['A6', 'Creu que pot iniciar canvis'],
      ['A7', 'Planifica i prioritza les tasques']
    ]),
    skill('G', 'Gestió emocional', '#c44f6d', [
      ['G1', 'Transmet alegria'],
      ['G2', 'Es mostra tranquil en situacions de pressió'],
      ['G3', 'Controla les emocions en conflictes'],
      ['G4', 'Assumeix la possibilitat d’equivocar-se'],
      ['G5', 'Accepta que les seves propostes no tirin endavant'],
      ['G6', 'Adequa el comportament a les circumstàncies'],
      ['G7', 'Reconeix com se sent']
    ]),
    skill('P', 'Habilitats de pensament', '#7454c8', [
      ['P1', 'Relaciona continguts nous amb coneixements previs'],
      ['P2', 'Fa bones reflexions sobre els continguts'],
      ['P3', 'Fa bones reflexions personals internes'],
      ['P4', 'Fa bones preguntes'],
      ['P5', 'Té idees creatives'],
      ['P6', 'Planteja bones estratègies de resolució'],
      ['P7', 'Expressa eficaçment les idees']
    ])
  ];

  const students = [
    'Romaissae Aarrass', 'Irene Amezcua', 'Joseph J. Angulo', 'Manuel A. Blandón', 'Aya Boutanghach',
    'Camila Cardozo', 'Mohamed Charefe', 'Hermelinda Conteh', 'Saray Durán', 'Yahya El Majdoub',
    'Sanae El Wardi', 'Youssef Es Sraidi', 'Sergio Fadrique', 'Younes Gamal', 'Youssef Gamal',
    'Elsa García', 'Marouane Ghannaj', 'Roser Gomila', 'Aya Hanouk', 'Tayri Hernández',
    'Taína Martínez', 'Santiago Noguera', 'Nada Nouinou', 'Brenda Pizarro', 'Anna Pulido',
    'Iker Quirós', 'Endriks Reyes', 'Biel Rodríguez', 'Gisela Rubiales', 'Aitor Ruiz',
    'Laura Solís', 'Leo Vásquez'
  ].map((name, index) => ({
    id: `student-${String(index + 1).padStart(2, '0')}`,
    name,
    email: `${normalize(name).replace(/\s+/g, '.')}@ramonpont.cat`,
    classGroup: '4t dESO'
  }));

  const cycles = [{ id: 'cycle-preview-1', name: 'Treball cooperatiu', classGroup: '4t dESO', status: 'active' }];
  const sessions = [{
    id: 'session-preview-1',
    cycleId: 'cycle-preview-1',
    name: 'Projecte de classe',
    classGroup: '4t dESO',
    accessCode: '123456',
    status: 'open',
    progress: { totalStudents: students.length, respondents: 18, pending: students.length - 18 }
  }];
  return { skills, students, cycles, sessions };
}

function loadPreviewData() {
  const base = buildPreviewData();
  try {
    const saved = JSON.parse(localStorage.getItem('pentabilities:previewData') || '{}');
    const savedCycles = Array.isArray(saved.cycles) ? saved.cycles : [];
    const savedSessions = Array.isArray(saved.sessions) ? saved.sessions : [];
    return {
      ...base,
      cycles: mergeById(savedCycles, base.cycles),
      sessions: mergeById(savedSessions, base.sessions),
      ratings: Array.isArray(saved.ratings) ? saved.ratings : []
    };
  } catch (error) {
    return { ...base, ratings: [] };
  }
}

function savePreviewData() {
  try {
    localStorage.setItem('pentabilities:previewData', JSON.stringify({
      cycles: PREVIEW.cycles,
      sessions: PREVIEW.sessions,
      ratings: PREVIEW.ratings || []
    }));
  } catch (error) {
    // La demo continua funcionant encara que el navegador bloquegi localStorage.
  }
}

function mergeById(primary, fallback) {
  const map = new Map();
  [...fallback, ...primary].forEach((item) => map.set(item.id, item));
  return [...map.values()];
}

function getPreviewRatings(sessionId, evaluatorId, evaluatorRole) {
  const evaluatorType = evaluatorRole === 'student' ? 'student' : 'teacher';
  return (PREVIEW.ratings || [])
    .filter((rating) => rating.sessionId === sessionId && rating.evaluatorId === evaluatorId && rating.evaluatorType === evaluatorType)
    .map((rating) => ({ evaluatedId: rating.evaluatedId, behaviorId: rating.behaviorId, value: Number(rating.value) }));
}

function savePreviewRatings(sessionId, evaluatorId, evaluatorRole, ratings) {
  const evaluatorType = evaluatorRole === 'student' ? 'student' : 'teacher';
  const existing = PREVIEW.ratings || [];
  const next = existing.filter((rating) => !(rating.sessionId === sessionId && rating.evaluatorId === evaluatorId && rating.evaluatorType === evaluatorType));
  ratings.forEach((rating) => {
    next.push({
      sessionId,
      evaluatorId,
      evaluatorType,
      evaluatedId: rating.evaluatedId,
      behaviorId: rating.behaviorId,
      value: Number(rating.value)
    });
  });
  PREVIEW.ratings = next;
  savePreviewData();
}

function skill(code, name, color, behaviors) {
  return {
    id: `skill-${code}`,
    code,
    name,
    color,
    behaviors: behaviors.map(([behaviorCode, behaviorName]) => ({
      id: `behavior-${behaviorCode}`,
      code: behaviorCode,
      name: behaviorName
    }))
  };
}

function previewNotice() {
  return '';
}

function previewBadgeText() {
  return '';
}

function setButtonLoading(button, text) {
  if (!button) return;
  button.disabled = true;
  button.textContent = text;
}

function resetButton(button, text) {
  if (!button) return;
  button.disabled = false;
  button.textContent = text;
}

function roleLabel(role) {
  return role === 'student' ? 'alumne' : role === 'admin' ? 'administrador' : 'professor';
}

function statusLabel(status) {
  return { active: 'actiu', closed: 'tancat', archived: 'arxivat', draft: 'esborrany', open: 'oberta' }[status] || status;
}

function typeLabel(key) {
  return { self: 'Autoavaluació', peer: 'Coavaluació', teacher: 'Heteroavaluació' }[key] || key;
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch (error) {
    return '';
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // El navegador pot bloquejar localStorage en alguns contextos.
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // El navegador pot bloquejar localStorage en alguns contextos.
  }
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatClassGroup(classGroup) {
  const value = String(classGroup || '').trim();
  const labels = {
    '1r dESO': "1r. d'ESO",
    '2n dESO': "2n. d'ESO",
    '3r dESO': "3r. d'ESO",
    '4t dESO': "4t. d'ESO"
  };
  return labels[value] || value;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButton();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallButton();
});

function updateInstallButton() {
  const button = document.querySelector('#install-button');
  if (!button) return;
  const user = state.boot?.user;
  const isTeacher = user && user.role !== 'student';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  button.hidden = !isTeacher || standalone;
}

async function installApp() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updateInstallButton();
    return;
  }
  showInstallHelp();
}

function showInstallHelp() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const android = /android/i.test(navigator.userAgent);
  const insecureLocal = !window.isSecureContext && location.protocol !== 'https:';
  const title = 'Instal·lar Pentabilities';
  const deviceSteps = ios
    ? '<li>Toca el boto de compartir del navegador.</li><li>Tria "Afegir a la pantalla d\'inici".</li><li>Confirma amb "Afegir".</li>'
    : android
      ? '<li>Obre el menu de Chrome amb els tres punts.</li><li>Tria "Instal·la l\'aplicacio" o "Afegeix a la pantalla d\'inici".</li><li>Confirma la instal·lacio.</li>'
      : '<li>Obre el menu del navegador.</li><li>Busca "Instal·la", "Afegeix a la pantalla d\'inici" o una opcio semblant.</li>';
  const secureNote = insecureLocal
    ? '<p class="muted install-warning">Ara estas entrant per una IP local amb HTTP. Alguns mobils no permeten instal·lar PWAs aixi. Quan l\'app estigui publicada amb HTTPS, el boto podra obrir la instal·lacio directament.</p>'
    : '<p class="muted">Si el navegador encara no mostra l\'opcio, actualitza la pagina i torna-ho a provar.</p>';
  const existing = document.querySelector('#install-help');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'install-help';
  modal.className = 'install-help';
  modal.innerHTML = `
    <div class="install-help-backdrop" onclick="closeInstallHelp()"></div>
    <div class="install-help-panel" role="dialog" aria-modal="true" aria-label="${title}">
      <button class="ghost install-help-close" onclick="closeInstallHelp()" aria-label="Tancar">×</button>
      <span class="install-help-icon" aria-hidden="true"><span class="install-icon"></span></span>
      <h2>${title}</h2>
      <ol>${deviceSteps}</ol>
      ${secureNote}
    </div>`;
  document.body.appendChild(modal);
}

function closeInstallHelp() {
  document.querySelector('#install-help')?.remove();
}

function refreshInstallAvailability() {
  updateInstallButton();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // La instal·lació PWA no ha de bloquejar l'ús de l'app.
    });
    refreshInstallAvailability();
  });
}

if (db) {
  db.auth.onAuthStateChange((event, session) => {
    state.authSession = session;
    if (event === 'SIGNED_OUT' && state.boot?.user) {
      state.boot = { needsLogin: true };
      state.ratings = {};
      render();
    }
  });
}

window.addEventListener('load', boot);

