const ACCESS_KEY = 'SoL';
const STORAGE_KEY = 'synapp:demo-state';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxJxdr8PCAUH_D7ELdCsBuICU3rbjXs8X_P1gTw2ZXQzgB0kJOvGBGSnTsxP5cg6LmGqA/exec';
const API_TIMEOUT_MS = 30000;

const demoData = {
  classes: [
    { id: 'eso1a', name: '1r ESO A' },
    { id: 'eso2a', name: '2n ESO A' },
    { id: 'eso3a', name: '3r ESO A' }
  ],
  students: [
    { id: 'a001', classId: 'eso1a', name: 'Aina Soler', type: 'A', active: true },
    { id: 'a002', classId: 'eso1a', name: 'Bilal Haddad', type: 'B', active: true },
    { id: 'a003', classId: 'eso1a', name: 'Carla Prat', type: 'C', active: true },
    { id: 'a004', classId: 'eso1a', name: 'Dani Roca', type: 'B', active: true },
    { id: 'a005', classId: 'eso1a', name: 'Emma Ruiz', type: 'A', active: true },
    { id: 'a006', classId: 'eso1a', name: 'Ferran Puig', type: 'B', active: true },
    { id: 'a007', classId: 'eso1a', name: 'Gisela Martín', type: 'C', active: true },
    { id: 'a008', classId: 'eso1a', name: 'Hugo López', type: 'B', active: true },
    { id: 'a009', classId: 'eso1a', name: 'Izan Camacho', type: 'B', active: true },
    { id: 'a010', classId: 'eso1a', name: 'Júlia Serra', type: 'A', active: true },
    { id: 'a011', classId: 'eso1a', name: 'Khadija Amrani', type: 'C', active: true },
    { id: 'a012', classId: 'eso1a', name: 'Leo Casas', type: 'B', active: true },
    { id: 'b001', classId: 'eso2a', name: 'Marc Vidal', type: 'A', active: true },
    { id: 'b002', classId: 'eso2a', name: 'Nora Jiménez', type: 'B', active: true },
    { id: 'b003', classId: 'eso2a', name: 'Omar El Idrissi', type: 'C', active: true },
    { id: 'b004', classId: 'eso2a', name: 'Paula Costa', type: 'B', active: true },
    { id: 'c001', classId: 'eso3a', name: 'Queralt Font', type: 'A', active: true },
    { id: 'c002', classId: 'eso3a', name: 'Rayan Bouzid', type: 'B', active: true },
    { id: 'c003', classId: 'eso3a', name: 'Sara Molina', type: 'C', active: true },
    { id: 'c004', classId: 'eso3a', name: 'Teo Aguilar', type: 'B', active: true }
  ],
  conditions: [
    {
      id: 'cond001',
      classId: 'eso1a',
      type: 'incompatibility',
      strength: 'required',
      studentIds: ['a002', 'a008']
    },
    {
      id: 'cond002',
      classId: 'eso1a',
      type: 'forced',
      strength: 'preferred',
      studentIds: ['a003', 'a010']
    }
  ],
  lastTeams: []
};

let state = loadState();
let selectedConditionStudentIds = new Set();
let classroomViewActive = false;
let hideTypesActive = false;

const els = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindEvents();
  renderClassSelect();
  renderAll();
  
  // Autologin si la contrasenya ja està guardada al navegador
  const savedKey = localStorage.getItem('synapp:access-key');
  if (savedKey === ACCESS_KEY) {
    await loadRemoteDataIfConfigured();
    els.accessView.classList.add('is-hidden');
    els.workspaceView.classList.remove('is-hidden');
  }
}

function cacheElements() {
  [
    'accessView', 'workspaceView', 'accessForm', 'accessKey', 'accessError',
    'classSelect', 'teamSize', 'teamMode', 'leftoversMode', 'generateBtn',
    'studentCount', 'typeSummary', 'conditionSummary',
    'studentsBody', 'studentFilter', 'addStudentBtn', 'conditionForm',
    'conditionType', 'conditionStrength', 'conditionStudents', 'selectedConditionChips',
    'clearConditionSelectionBtn', 'addConditionSubmitBtn', 'conditionError',
    'conditionsList', 'teamsGrid', 'resultsHint', 'copyTeamsBtn', 'saveTeamsBtn',
    'reportContent', 'lockAppBtn', 'saveState', 'exportCsvBtn', 'exportExcelBtn', 'printBtn',
    'classroomViewBtn', 'hideTypesBtn', 'classroomHint',
    'studentDialog', 'studentDialogForm', 'newStudentName', 'newStudentType', 'newStudentActive', 'closeStudentDialogBtn'
  ].forEach(id => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.accessForm.addEventListener('submit', handleAccess);
  els.lockAppBtn.addEventListener('click', lockApp);
  els.classSelect.addEventListener('change', () => {
    state.selectedClassId = els.classSelect.value;
    state.lastTeams = [];
    selectedConditionStudentIds.clear();
    persistState();
    renderAll();
  });
  els.studentFilter.addEventListener('change', renderStudents);
  els.addStudentBtn.addEventListener('click', () => {
    els.newStudentName.value = '';
    els.newStudentType.value = 'B';
    els.newStudentActive.value = 'true';
    els.studentDialog.showModal();
  });
  els.closeStudentDialogBtn.addEventListener('click', () => els.studentDialog.close());
  els.studentDialogForm.addEventListener('submit', submitNewStudent);
  els.conditionType.addEventListener('change', renderConditionControls);
  els.conditionStrength.addEventListener('change', renderConditionControls);
  bindSegmentedConditionControls();
  els.clearConditionSelectionBtn.addEventListener('click', clearConditionSelection);
  els.conditionForm.addEventListener('submit', addCondition);
  els.generateBtn.addEventListener('click', generateAndRenderTeams);
  els.copyTeamsBtn.addEventListener('click', copyTeams);
  els.exportCsvBtn.addEventListener('click', exportTeamsCsv);
  els.exportExcelBtn.addEventListener('click', exportTeamsExcel);
  els.printBtn.addEventListener('click', () => {
    window.print();
  });
  els.saveTeamsBtn.addEventListener('click', saveTeamsRemote);
  els.classroomViewBtn.addEventListener('click', toggleClassroomView);
  els.hideTypesBtn.addEventListener('click', toggleHideTypes);
}

function bindSegmentedConditionControls() {
  document.querySelectorAll('[data-condition-type]').forEach(button => {
    button.addEventListener('click', () => {
      els.conditionType.value = button.dataset.conditionType;
      document.querySelectorAll('[data-condition-type]').forEach(item => item.classList.toggle('is-active', item === button));
      renderConditionControls();
    });
  });

  document.querySelectorAll('[data-condition-strength]').forEach(button => {
    button.addEventListener('click', () => {
      els.conditionStrength.value = button.dataset.conditionStrength;
      document.querySelectorAll('[data-condition-strength]').forEach(item => item.classList.toggle('is-active', item === button));
      renderConditionControls();
    });
  });
}

function setSaveState(message, status = 'local') {
  els.saveState.className = `save-state status-${status}`;
  els.saveState.innerHTML = `<span class="save-dot" aria-hidden="true"></span>${escapeHtml(message)}`;
}

async function handleAccess(event) {
  event.preventDefault();
  if (els.accessKey.value === ACCESS_KEY) {
    els.accessError.textContent = '';
    // Desar la contrasenya per a futures visites
    localStorage.setItem('synapp:access-key', els.accessKey.value);
    await loadRemoteDataIfConfigured();
    els.accessView.classList.add('is-hidden');
    els.workspaceView.classList.remove('is-hidden');
    return;
  }
  els.accessError.textContent = 'La clau no és correcta.';
}

async function loadRemoteDataIfConfigured() {
  if (!APPS_SCRIPT_URL) {
    setSaveState('Mode demo local', 'local');
    return;
  }
  setSaveState('Carregant dades del Sheets...', 'pending');
  try {
    const payload = await apiPost('bootstrap', {});
    if (!payload.ok) throw new Error(payload.error || 'No data');
    state = {
      classes: payload.classes || [],
      students: payload.students || [],
      conditions: payload.conditions || [],
      lastTeams: payload.lastTeams || [],
      selectedClassId: payload.classes?.[0]?.id || ''
    };
    selectedConditionStudentIds.clear();
    persistState();
    renderClassSelect();
    renderAll();
    setSaveState('Connectat al Google Sheets', 'connected');
  } catch (error) {
    setSaveState('No s’ha pogut connectar. Mode demo local.', 'error');
  }
}

function lockApp() {
  // Esborrar la contrasenya del recordatori en bloquejar voluntàriament
  localStorage.removeItem('synapp:access-key');
  els.accessKey.value = '';
  els.workspaceView.classList.add('is-hidden');
  els.accessView.classList.remove('is-hidden');
  els.accessKey.focus();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (error) {
    // En mode demo, si el navegador bloqueja l'emmagatzematge, continuem.
  }
  return structuredClone(demoData);
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Ignorem l'error perquè el prototip ha de continuar funcionant.
  }
}

// El mètode de reiniciar demo s'ha eliminat ja que s'utilitzen dades del full central en producció.

function renderClassSelect() {
  els.classSelect.innerHTML = '';
  state.classes.forEach(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    els.classSelect.appendChild(option);
  });
  if (!state.selectedClassId) {
    state.selectedClassId = state.classes[0]?.id || '';
  }
  els.classSelect.value = state.selectedClassId;
}

function renderAll() {
  renderStudents();
  renderConditionStudentOptions();
  renderConditionControls();
  renderConditions();
  renderSummary();
  renderTeams(state.lastTeams || []);
  renderReport(state.lastReport || null);
}

function currentStudents() {
  return state.students
    .filter(student => student.classId === state.selectedClassId)
    .sort(compareStudentsBySurname);
}

function activeStudents() {
  return currentStudents().filter(student => student.active);
}

function compareStudentsBySurname(a, b) {
  const aKey = `${a.lastName || surnameFromName(a.name)} ${a.firstName || a.name}`;
  const bKey = `${b.lastName || surnameFromName(b.name)} ${b.firstName || b.name}`;
  return aKey.localeCompare(bKey, 'ca', { sensitivity: 'base' });
}

function surnameFromName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || '';
}

function currentConditions() {
  return state.conditions.filter(condition => condition.classId === state.selectedClassId);
}

function applicableConditions(students = activeStudents()) {
  const activeIds = new Set(students.map(student => student.id));
  return currentConditions().filter(condition => condition.studentIds.every(id => activeIds.has(id)));
}

function studentById(id) {
  return state.students.find(student => student.id === id);
}

function renderStudents() {
  const query = '';
  const filterVal = els.studentFilter.value;
  let students = currentStudents().filter(student => normalise(student.name).includes(query));

  if (filterVal === 'active') {
    students = students.filter(s => s.active);
  } else if (filterVal === 'inactive') {
    students = students.filter(s => !s.active);
  } else if (['A', 'B', 'C'].includes(filterVal)) {
    students = students.filter(s => s.type === filterVal);
  }

  els.studentsBody.innerHTML = '';

  if (students.length === 0) {
    els.studentsBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--muted); padding: 16px;">Cap alumne coincideix amb els filtres.</td></tr>';
    return;
  }

  students.forEach(student => {
    const conditions = state.conditions.filter(c => c.classId === state.selectedClassId && c.studentIds.includes(student.id));
    const condBadge = conditions.length > 0 
      ? `<span class="student-cond-badge" title="${conditions.length} condicions actives per a aquest alumne">${conditions.length}</span>`
      : '';

    const row = document.createElement('tr');
    row.className = student.active ? '' : 'is-inactive';
    row.innerHTML = `
      <td>
        <div class="student-name-cell" style="display: flex; align-items: center; gap: 8px;">
          <span class="student-name">${escapeHtml(student.name)}</span>
          ${condBadge}
        </div>
      </td>
      <td>${renderTypeButtons(student)}</td>
      <td><button class="status-toggle ${student.active ? 'is-active' : 'is-inactive'}" type="button" data-active-toggle="${student.id}">${student.active ? 'Actiu' : 'Inactiu'}</button></td>
    `;
    row.querySelectorAll('button[data-type]').forEach(button => {
      button.addEventListener('click', () => {
        student.type = button.dataset.type;
        persistState();
        renderAll();
        saveStudentTypeRemote(student);
      });
    });
    row.querySelector('[data-active-toggle]').addEventListener('click', () => {
      student.active = !student.active;
      persistState();
      renderAll();
      saveStudentActiveRemote(student);
    });
    els.studentsBody.appendChild(row);
  });
}

function renderTypeButtons(student) {
  return `
    <div class="type-buttons" aria-label="Tipologia de ${escapeHtml(student.name)}">
      ${['A', 'B', 'C'].map(type => `
        <button
          class="type-btn type-${type.toLowerCase()} ${student.type === type ? 'is-active' : ''}"
          type="button"
          data-type="${type}"
          aria-label="Marca ${escapeHtml(student.name)} com a tipologia ${type}">
          ${type}
        </button>
      `).join('')}
    </div>
  `;
}

function submitNewStudent(event) {
  event.preventDefault();
  const name = els.newStudentName.value.trim();
  const type = els.newStudentType.value;
  const active = els.newStudentActive.value === 'true';
  
  if (!name) return;
  
  state.students.push({
    id: `local-${Date.now()}`,
    classId: state.selectedClassId,
    name: name,
    type: type,
    active: active
  });
  
  persistState();
  renderAll();
  els.studentDialog.close();
}

function renderConditionStudentOptions() {
  els.conditionStudents.innerHTML = '';
  const query = '';
  const students = currentStudents().filter(student => normalise(student.name).includes(query));
  const validIds = new Set(currentStudents().map(student => student.id));
  selectedConditionStudentIds = new Set(Array.from(selectedConditionStudentIds).filter(id => validIds.has(id)));
  
  if (students.length === 0) {
    els.conditionStudents.innerHTML = '<p class="empty-report">Cap alumne coincideix amb el filtre.</p>';
    renderSelectedConditionChips();
    return;
  }
  students.forEach(student => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `student-pick type-${student.type.toLowerCase()} ${student.active ? '' : 'is-inactive'}`;
    button.dataset.studentId = student.id;
    button.disabled = !student.active;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', selectedConditionStudentIds.has(student.id) ? 'true' : 'false');
    button.classList.toggle('is-selected', selectedConditionStudentIds.has(student.id));
    button.innerHTML = `<span class="type-dot type-${student.type.toLowerCase()}">${student.type}</span><span>${escapeHtml(student.name)}</span>${student.active ? '' : '<small>Inactiu</small>'}`;
    button.addEventListener('click', () => {
      if (!student.active) return;
      if (selectedConditionStudentIds.has(student.id)) {
        selectedConditionStudentIds.delete(student.id);
      } else {
        selectedConditionStudentIds.add(student.id);
      }
      renderConditionStudentOptions();
    });
    els.conditionStudents.appendChild(button);
  });
  renderSelectedConditionChips();
}

function renderConditionControls() {
  els.addConditionSubmitBtn.textContent = 'Afegeix condició';
  renderSelectedConditionChips();
}

function renderSelectedConditionChips() {
  const selected = Array.from(selectedConditionStudentIds)
    .map(id => studentById(id))
    .filter(Boolean);

  els.clearConditionSelectionBtn.disabled = selected.length === 0;
  els.selectedConditionChips.classList.toggle('is-empty', selected.length === 0);

  if (selected.length === 0) {
    els.selectedConditionChips.innerHTML = '';
    return;
  }

  els.selectedConditionChips.innerHTML = selected.map(student => `
    <button class="selected-chip type-${student.type.toLowerCase()}" type="button" data-remove-condition-student="${student.id}">
      <span class="type-dot type-${student.type.toLowerCase()}">${student.type}</span>
      ${escapeHtml(student.name)}
      <span aria-hidden="true">×</span>
    </button>
  `).join('');

  els.selectedConditionChips.querySelectorAll('[data-remove-condition-student]').forEach(button => {
    button.addEventListener('click', () => {
      selectedConditionStudentIds.delete(button.dataset.removeConditionStudent);
      renderConditionStudentOptions();
    });
  });
}

function clearConditionSelection() {
  selectedConditionStudentIds.clear();
  renderConditionStudentOptions();
}

function findContradictoryCondition(newCondition) {
  return currentConditions().find(existing => {
    const samePeople = existing.studentIds.length === newCondition.studentIds.length
      && existing.studentIds.every(id => newCondition.studentIds.includes(id));
    return samePeople && existing.type !== newCondition.type;
  });
}

function addCondition(event) {
  event.preventDefault();
  const selected = Array.from(selectedConditionStudentIds);
  if (selected.length < 2) {
    els.conditionError.textContent = 'Tria com a mínim dos alumnes.';
    return;
  }

  const newCondition = {
    id: `cond-${Date.now()}`,
    classId: state.selectedClassId,
    type: els.conditionType.value,
    strength: els.conditionStrength.value,
    studentIds: selected
  };

  if (findContradictoryCondition(newCondition)) {
    els.conditionError.textContent = 'Aquests alumnes ja tenen una condició contradictòria. Revisa la llista abans de continuar.';
    return;
  }

  els.conditionError.textContent = '';
  state.conditions.push(newCondition);
  selectedConditionStudentIds.clear();
  persistState();
  renderAll();
}

function renderConditions() {
  els.conditionsList.innerHTML = '';
  const conditions = currentConditions();
  if (conditions.length === 0) {
    els.conditionsList.innerHTML = '<p class="empty-report">Encara no hi ha condicions.</p>';
    return;
  }

  conditions.forEach(condition => {
    const names = condition.studentIds
      .map(id => studentById(id)?.name)
      .filter(Boolean)
      .join(', ');
    const item = document.createElement('article');
    item.className = `condition-item condition-${condition.type} condition-${condition.strength}`;
    item.innerHTML = `
      <span class="condition-icon" aria-hidden="true">${condition.type === 'forced' ? conditionGroupIcon() : conditionSeparateIcon()}</span>
      <div>
        <p class="condition-title">${condition.type === 'forced' ? 'Agrupa' : 'Separa'} <span>${condition.strength === 'required' ? 'Oblig.' : 'Pref.'}</span></p>
        <p class="condition-meta">${escapeHtml(names)}</p>
      </div>
      <button class="remove-btn" type="button" aria-label="Elimina condició" title="Elimina condició">
        <span class="btn-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9h8V9h2v11H7V9Z"/></svg></span>
      </button>
    `;
    item.querySelector('button').addEventListener('click', () => {
      state.conditions = state.conditions.filter(existing => existing.id !== condition.id);
      persistState();
      renderAll();
    });
    els.conditionsList.appendChild(item);
  });
}

function conditionGroupIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M7 11a4 4 0 1 1 3.5-5.9A5.8 5.8 0 0 0 10 7.5c0 1.2.4 2.4 1.1 3.3A4 4 0 0 1 7 11Zm10 0a4 4 0 1 0-3.5-5.9c.3.7.5 1.5.5 2.4s-.2 1.7-.5 2.4A4 4 0 0 0 17 11ZM7 13c-2.7 0-5 1.3-5 3v2h8.5a6.5 6.5 0 0 1 1.6-3.8A8.6 8.6 0 0 0 7 13Zm10 0c-2.7 0-5 1.3-5 3v2h10v-2c0-1.7-2.3-3-5-3Z"/></svg>';
}

function conditionSeparateIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M7 5a4 4 0 1 1 0 8A4 4 0 0 1 7 5Zm10 0a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM2 19c0-2.2 2.7-4 5-4s5 1.8 5 4v1H2v-1Zm10.7-4.9 1.4-1.4 2.4 2.4 2.4-2.4 1.4 1.4-2.4 2.4 2.4 2.4-1.4 1.4-2.4-2.4-2.4 2.4-1.4-1.4 2.4-2.4-2.4-2.4Z"/></svg>';
}

function conditionTitle(condition) {
  const typeText = condition.type === 'forced' ? 'Agrupament forçat' : 'No poden anar junts';
  const strengthText = condition.strength === 'required' ? 'obligatori' : 'preferent';
  return `${typeText} · ${strengthText}`;
}

function renderSummary() {
  const students = activeStudents();
  const allStudents = currentStudents();
  const counts = countTypes(students);
  const conditions = applicableConditions(students);
  const required = conditions.filter(item => item.strength === 'required').length;
  const preferred = conditions.filter(item => item.strength === 'preferred').length;

  els.studentCount.textContent = allStudents.length === students.length ? String(students.length) : `${students.length}/${allStudents.length}`;
  els.typeSummary.textContent = `${counts.A}A · ${counts.B}B · ${counts.C}C`;
  els.conditionSummary.textContent = `${required} oblig. · ${preferred} pref.`;
  if (els.scoreSummary) {
    els.scoreSummary.textContent = state.lastReport ? `${state.lastReport.score}%` : 'Encara no';
  }
}

function generateAndRenderTeams() {
  const students = shuffle(activeStudents());
  if (students.length === 0) return;

  const options = {
    size: Number(els.teamSize.value),
    mode: els.teamMode.value,
    leftovers: els.leftoversMode.value,
    conditions: applicableConditions(students)
  };

  const validation = validateConditions(options.conditions, options.size);
  const teams = buildTeams(students, options);
  const report = evaluateTeams(teams, options, validation.warnings);

  state.lastTeams = teams;
  state.lastReport = report;
  persistState();
  renderSummary();
  renderTeams(teams);
  renderReport(report);
}

function validateConditions(conditions, size) {
  const warnings = [];
  const requiredForced = conditions.filter(item => item.type === 'forced' && item.strength === 'required');
  requiredForced.forEach(item => {
    if (item.studentIds.length > size) {
      warnings.push(`Agrupament forçat massa gran per a equips de ${size}: ${namesFor(item.studentIds)}.`);
    }
  });

  conditions.forEach((first, index) => {
    conditions.slice(index + 1).forEach(second => {
      const samePeople = first.studentIds.length === second.studentIds.length
        && first.studentIds.every(id => second.studentIds.includes(id));
      if (samePeople && first.type !== second.type) {
        warnings.push(`Contradicció entre condicions: ${namesFor(first.studentIds)}.`);
      }
    });
  });

  return { warnings };
}

function buildTeams(students, options) {
  const forcedRequired = options.conditions
    .filter(item => item.type === 'forced' && item.strength === 'required')
    .map(item => item.studentIds);
  const used = new Set();
  const units = [];

  forcedRequired.forEach(groupIds => {
    const unit = groupIds.map(id => students.find(student => student.id === id)).filter(Boolean);
    if (unit.length > 0 && unit.length <= options.size) {
      unit.forEach(student => used.add(student.id));
      units.push(unit);
    }
  });

  students.forEach(student => {
    if (!used.has(student.id)) units.push([student]);
  });

  const sortedUnits = sortUnitsByMode(units, options.mode);
  const teamCount = Math.max(1, Math.floor(students.length / options.size));
  const initialCount = options.leftovers === 'small-team'
    ? Math.ceil(students.length / options.size)
    : teamCount;
  const teams = Array.from({ length: initialCount }, () => []);

  sortedUnits.forEach(unit => {
    const target = chooseBestTeam(teams, unit, options);
    teams[target].push(...unit);
  });

  return teams.filter(team => team.length > 0);
}

function sortUnitsByMode(units, mode) {
  if (mode === 'random') return shuffle(units);
  if (mode === 'similar') {
    return [...units].sort((a, b) => dominantType(a).localeCompare(dominantType(b)));
  }
  const priority = { A: 0, C: 1, B: 2 };
  return [...units].sort((a, b) => priority[dominantType(a)] - priority[dominantType(b)]);
}

function chooseBestTeam(teams, unit, options) {
  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  teams.forEach((team, index) => {
    const score = scoreTeamForUnit(team, unit, options);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function scoreTeamForUnit(team, unit, options) {
  let score = 0;
  const projected = [...team, ...unit];
  const sizeOverflow = Math.max(0, projected.length - options.size);
  score += sizeOverflow * 60;
  score += Math.abs(options.size - projected.length) * 3;

  if (options.mode === 'balanced') {
    const counts = countTypes(projected);
    score += Math.max(0, counts.A - 1) * 6;
    score += Math.max(0, counts.C - 1) * 6;
    score += Math.max(0, counts.B - 2) * 2;
  }

  if (options.mode === 'similar') {
    const types = new Set(projected.map(student => student.type));
    score += types.size * 8;
  }

  options.conditions.forEach(condition => {
    const ids = projected.map(student => student.id);
    const hits = condition.studentIds.filter(id => ids.includes(id)).length;
    if (condition.type === 'incompatibility' && hits > 1) {
      score += condition.strength === 'required' ? 1000 : 35;
    }
    if (condition.type === 'forced' && hits > 0 && hits < condition.studentIds.length) {
      score += condition.strength === 'required' ? 300 : 18;
    }
  });

  return score;
}

function evaluateTeams(teams, options, initialWarnings) {
  const report = {
    score: 0,
    rows: [],
    warnings: [...initialWarnings]
  };
  const conditionStats = evaluateConditions(teams, options.conditions);
  const sizeStats = evaluateSizes(teams, options.size);
  const balanceStats = evaluateBalance(teams, options.mode);

  report.rows.push(...conditionStats.rows, sizeStats, balanceStats);
  report.warnings.push(...conditionStats.warnings);

  const weighted = report.rows.reduce((acc, row) => acc + (row.score * row.weight), 0);
  const totalWeight = report.rows.reduce((acc, row) => acc + row.weight, 0);
  report.score = totalWeight > 0 ? Math.round(weighted / totalWeight) : 100;
  return report;
}

function evaluateConditions(teams, conditions) {
  const rows = [];
  const warnings = [];
  const groups = [
    ['Incompatibilitats obligatòries', 'incompatibility', 'required', 4],
    ['Agrupaments forçats obligatoris', 'forced', 'required', 4],
    ['Incompatibilitats preferents', 'incompatibility', 'preferred', 2],
    ['Agrupaments forçats preferents', 'forced', 'preferred', 2]
  ];

  groups.forEach(([label, type, strength, weight]) => {
    const matching = conditions.filter(item => item.type === type && item.strength === strength);
    if (matching.length === 0) return;
    let ok = 0;
    matching.forEach(condition => {
      const respected = isConditionRespected(teams, condition);
      if (respected) {
        ok += 1;
      } else {
        warnings.push(`${label.slice(0, -1)} no complert: ${namesFor(condition.studentIds)}.`);
      }
    });
    rows.push({
      label,
      value: `${ok} de ${matching.length}`,
      score: Math.round((ok / matching.length) * 100),
      weight
    });
  });

  return { rows, warnings };
}

function isConditionRespected(teams, condition) {
  if (condition.type === 'incompatibility') {
    return teams.every(team => condition.studentIds.filter(id => team.some(student => student.id === id)).length <= 1);
  }
  return teams.some(team => condition.studentIds.every(id => team.some(student => student.id === id)));
}

function evaluateSizes(teams, size) {
  const exactOrNear = teams.filter(team => team.length === size || team.length === size + 1).length;
  return {
    label: 'Mida dels equips',
    value: `${exactOrNear} de ${teams.length}`,
    score: Math.round((exactOrNear / teams.length) * 100),
    weight: 2
  };
}

function evaluateBalance(teams, mode) {
  if (mode === 'random') {
    return { label: 'Equilibri A/B/C', value: 'No prioritari', score: 100, weight: 1 };
  }
  const good = teams.filter(team => {
    const counts = countTypes(team);
    if (mode === 'similar') {
      return new Set(team.map(student => student.type)).size <= 2;
    }
    return counts.A <= 1 && counts.C <= 1;
  }).length;
  return {
    label: 'Equilibri A/B/C',
    value: `${good} de ${teams.length}`,
    score: Math.round((good / teams.length) * 100),
    weight: 2
  };
}

function renderTeams(teams) {
  els.teamsGrid.innerHTML = '';
  const hasTeams = teams && teams.length > 0;
  els.copyTeamsBtn.disabled = !hasTeams;
  els.exportCsvBtn.disabled = !hasTeams;
  els.exportExcelBtn.disabled = !hasTeams;
  els.printBtn.disabled = !hasTeams;
  els.saveTeamsBtn.disabled = !hasTeams;
  els.classroomViewBtn.disabled = !hasTeams;
  els.hideTypesBtn.disabled = !hasTeams;
  if (!hasTeams && classroomViewActive) {
    setClassroomView(false);
  }
  if (!hasTeams && hideTypesActive) {
    setHideTypes(false);
  }
  els.resultsHint.textContent = hasTeams
    ? resultsSummaryText(teams)
    : 'Genera una proposta per veure els equips.';

  teams.forEach((team, index) => {
    const counts = countTypes(team);
    const total = team.length || 1;
    const card = document.createElement('article');
    card.className = 'team-card';
    
    // Drag & Drop handlers per a la targeta d'equip
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const studentId = e.dataTransfer.getData('text/plain');
      const sourceTeamIdx = parseInt(e.dataTransfer.getData('source-team-index'), 10);
      const targetTeamIdx = index;
      
      if (sourceTeamIdx === targetTeamIdx) return;
      
      const studentIdx = state.lastTeams[sourceTeamIdx].findIndex(s => s.id === studentId);
      if (studentIdx !== -1) {
        const [student] = state.lastTeams[sourceTeamIdx].splice(studentIdx, 1);
        state.lastTeams[targetTeamIdx].push(student);
        
        // Recalcular l'informe després de la modificació manual
        const options = {
          size: Number(els.teamSize.value),
          mode: els.teamMode.value,
          leftovers: els.leftoversMode.value,
          conditions: applicableConditions()
        };
        const validation = validateConditions(options.conditions, options.size);
        const report = evaluateTeams(state.lastTeams, options, validation.warnings);
        state.lastReport = report;
        
        persistState();
        renderSummary();
        renderTeams(state.lastTeams);
        renderReport(report);
      }
    });

    card.innerHTML = `
      <header class="team-header">
        <div>
          <h3>Equip ${index + 1}</h3>
          <span class="tag-compact">${counts.A}A · ${counts.B}B · ${counts.C}C</span>
        </div>
        <div class="team-composition-bar" aria-label="Composició de tipologies en aquest grup">
          <div class="bar-segment bar-type-a" style="width: ${(counts.A / total) * 100}%" title="Tipologia A: ${counts.A}"></div>
          <div class="bar-segment bar-type-b" style="width: ${(counts.B / total) * 100}%" title="Tipologia B: ${counts.B}"></div>
          <div class="bar-segment bar-type-c" style="width: ${(counts.C / total) * 100}%" title="Tipologia C: ${counts.C}"></div>
        </div>
      </header>
      <ul class="team-list">
        ${team.map(student => `
          <li class="student-chip" draggable="true" data-student-id="${student.id}" data-team-index="${index}">
            <span class="type-dot type-${student.type.toLowerCase()}">${student.type}</span>
            <strong>${escapeHtml(student.name)}</strong>
            <span class="drag-handle" aria-hidden="true" title="Arrossega per moure l'alumne">
              <svg viewBox="0 0 24 24"><path d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
            </span>
          </li>
        `).join('')}
      </ul>
    `;

    card.querySelectorAll('.student-chip').forEach(chip => {
      chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', chip.dataset.studentId);
        e.dataTransfer.setData('source-team-index', chip.dataset.teamIndex);
        chip.classList.add('is-dragging');
      });
      chip.addEventListener('dragend', () => {
        chip.classList.remove('is-dragging');
      });
    });

    els.teamsGrid.appendChild(card);
  });
}

function resultsSummaryText(teams) {
  const score = state.lastReport ? ` · ${state.lastReport.score}% compliment` : '';
  const students = teams.reduce((total, team) => total + team.length, 0);
  return `${teams.length} equips · ${students} alumnes${score}. Pots arrossegar alumnes entre equips.`;
}

function toggleClassroomView() {
  setClassroomView(!classroomViewActive);
}

function setClassroomView(active) {
  classroomViewActive = active;
  document.body.classList.toggle('classroom-view-active', active);
  els.classroomHint.classList.toggle('is-hidden', !active);
  els.classroomViewBtn.classList.toggle('is-active', active);
  els.classroomViewBtn.innerHTML = active
    ? '<span class="btn-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18.3 5.7 16.9 4.3 12 9.2 7.1 4.3 5.7 5.7 10.6 10.6 5.7 15.5 7.1 16.9 12 12 16.9 16.9 18.3 15.5 13.4 10.6 18.3 5.7Z"/></svg></span>Surt de vista aula'
    : '<span class="btn-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v10H4V5Zm2 2v6h12V7H6Zm-1 11h14v2H5v-2Z"/></svg></span>Vista aula';
}

function toggleHideTypes() {
  setHideTypes(!hideTypesActive);
}

function setHideTypes(active) {
  hideTypesActive = active;
  document.body.classList.toggle('hide-types-active', active);
  els.hideTypesBtn.classList.toggle('is-active', active);
  els.hideTypesBtn.innerHTML = active
    ? '<span class="btn-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4.5c4.3 0 8.2 3.2 10 7.5-1.8 4.3-5.7 7.5-10 7.5S3.8 16.3 2 12c1.8-4.3 5.7-7.5 10-7.5Zm0 2C8.9 6.5 6.1 8.6 4.4 12c1.7 3.4 4.5 5.5 7.6 5.5s5.9-2.1 7.6-5.5C17.9 8.6 15.1 6.5 12 6.5Zm0 2A3.5 3.5 0 1 1 12 15.5 3.5 3.5 0 0 1 12 8.5Z"/></svg></span>Mostra tipologies'
    : '<span class="btn-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 6.5c3.8 0 6.7 3.1 8 5.5-.6 1.1-1.6 2.4-2.9 3.4L18.5 17C20 15.7 21.2 14 22 12c-1.8-4.3-5.7-7.5-10-7.5-1.5 0-2.9.4-4.2 1.1l1.5 1.5c.8-.4 1.7-.6 2.7-.6ZM2.7 3.3 1.4 4.6l3 3C3.4 8.8 2.6 10.3 2 12c1.8 4.3 5.7 7.5 10 7.5 1.7 0 3.3-.5 4.7-1.4l2.7 2.7 1.3-1.3-18-18ZM7 10.2l1.5 1.5V12a3.5 3.5 0 0 0 3.5 3.5h.3l1.5 1.5c-.6.2-1.2.3-1.8.3-3.1 0-5.9-2.1-7.6-5.3.6-1.1 1.5-2.2 2.6-3.1v1.3Zm4.9-1.7 3.6 3.6V12A3.5 3.5 0 0 0 12 8.5h-.1Z"/></svg></span>Oculta tipologies';
}

function renderReport(report) {
  if (!report) {
    els.reportContent.className = 'report-content empty-report';
    els.reportContent.textContent = "Encara no s'ha generat cap proposta.";
    return;
  }

  els.reportContent.className = 'report-content';
  const assessment = reportAssessment(report);
  const warningsHtml = report.warnings.length > 0 ? `
    <div class="report-warnings-container">
      ${report.warnings.map(warning => {
        let type = 'warning';
        let icon = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
        if (warning.toLowerCase().includes('contradicció') || warning.toLowerCase().includes('obligatori') || warning.toLowerCase().includes('no complert')) {
          type = 'danger';
          icon = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
        }
        return `
          <div class="report-warning-item warning-${type}">
            <span class="warning-icon">${icon}</span>
            <span class="warning-text">${escapeHtml(warning)}</span>
          </div>
        `;
      }).join('')}
    </div>
  ` : '<p class="status-pill-success"><span class="success-icon"><svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>Cap avís rellevant</p>';

  els.reportContent.innerHTML = `
    <section class="report-dashboard">
      <article class="score-card score-${assessment.level}">
        <span class="score-label">Compliment global</span>
        <strong class="score-number">${report.score}%</strong>
        <span class="score-verdict">${assessment.title}</span>
      </article>
      <article class="report-recommendation">
        <span class="recommendation-icon" aria-hidden="true">${assessment.icon}</span>
        <div>
          <strong>${assessment.heading}</strong>
          <p>${assessment.action}</p>
        </div>
      </article>
    </section>
    <section class="criteria-grid" aria-label="Criteris de compliment">
      ${report.rows.map(row => `
        <article class="criterion-card">
          <span class="criterion-icon" aria-hidden="true">${criterionIcon(row.label)}</span>
          <div class="criterion-copy">
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}</strong>
          </div>
          <span class="criterion-score">${row.score}%</span>
          <span class="criterion-bar" aria-hidden="true"><span style="width: ${row.score}%"></span></span>
        </article>
      `).join('')}
    </section>
    ${warningsHtml}
  `;
}

function criterionIcon(label) {
  if (label.includes('Incompatibilitats')) {
    return '<svg viewBox="0 0 24 24"><path d="M7 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm10 0a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM2 19c0-2.2 2.7-4 5-4s5 1.8 5 4v1H2v-1Zm10.7-4.9 1.4-1.4 2.4 2.4 2.4-2.4 1.4 1.4-2.4 2.4 2.4 2.4-1.4 1.4-2.4-2.4-2.4 2.4-1.4-1.4 2.4-2.4-2.4-2.4Z"/></svg>';
  }
  if (label.includes('Agrupaments')) {
    return '<svg viewBox="0 0 24 24"><path d="M7 11a4 4 0 1 1 3.5-5.9A5.8 5.8 0 0 0 10 7.5c0 1.2.4 2.4 1.1 3.3A4 4 0 0 1 7 11Zm10 0a4 4 0 1 0-3.5-5.9c.3.7.5 1.5.5 2.4s-.2 1.7-.5 2.4A4 4 0 0 0 17 11ZM7 13c-2.7 0-5 1.3-5 3v2h8.5a6.5 6.5 0 0 1 1.6-3.8A8.6 8.6 0 0 0 7 13Zm10 0c-2.7 0-5 1.3-5 3v2h10v-2c0-1.7-2.3-3-5-3Z"/></svg>';
  }
  if (label.includes('Mida')) {
    return '<svg viewBox="0 0 24 24"><path d="M4 5h16v4H4V5Zm0 6h10v4H4v-4Zm0 6h16v4H4v-4Z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24"><path d="M5 4h4v4H5V4Zm10 0h4v4h-4V4ZM5 16h4v4H5v-4Zm10 0h4v4h-4v-4ZM8 9h8v2H8V9Zm0 4h8v2H8v-2Z"/></svg>';
}

function reportAssessment(report) {
  if (report.warnings.length > 0 && report.score < 80) {
    return {
      level: 'danger',
      heading: 'Revisió necessària',
      icon: '<svg viewBox="0 0 24 24"><path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V8h2v5Z"/></svg>',
      title: 'Cal revisar abans d’usar-la',
      action: 'Revisa els avisos, mou algun alumne manualment o genera una proposta nova.'
    };
  }
  if (report.warnings.length > 0) {
    return {
      level: 'warning',
      heading: 'Proposta aprofitable',
      icon: '<svg viewBox="0 0 24 24"><path d="M11 7h2v7h-2V7Zm0 9h2v2h-2v-2ZM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/></svg>',
      title: 'Bona proposta amb algun avís',
      action: 'La proposta és aprofitable, però convé comprovar les condicions marcades.'
    };
  }
  if (report.score >= 90) {
    return {
      level: 'success',
      heading: 'Proposta sòlida',
      icon: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/></svg>',
      title: 'Molt bona proposta',
      action: 'La distribució respecta els criteris principals i és adequada per desar o exportar.'
    };
  }
  return {
    level: 'ok',
    heading: 'Proposta usable',
    icon: '<svg viewBox="0 0 24 24"><path d="M12 2 3 6v6c0 5 3.8 9.7 9 10 5.2-.3 9-5 9-10V6l-9-4Zm-1 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4-6.3 6.3Z"/></svg>',
    title: 'Proposta acceptable',
    action: 'Es pot utilitzar, però pots regenerar-la si vols buscar una distribució més fina.'
  };
}
function copyTeams() {
  const teams = state.lastTeams || [];
  const text = teams.map((team, index) => {
    const names = team.map(student => `${student.name} (${student.type})`).join(', ');
    return `Equip ${index + 1}: ${names}`;
  }).join('\n');
  navigator.clipboard.writeText(text);
  setSaveState('Equips copiats', 'connected');
}

function exportTeamsCsv() {
  const teams = state.lastTeams || [];
  if (teams.length === 0) return;
  const selectedClass = state.classes.find(item => item.id === state.selectedClassId);
  const rows = [
    ['Classe', 'Equip', 'Alumne', 'Tipologia'],
    ...teams.flatMap((team, index) => team.map(student => [
      selectedClass?.name || '',
      `Equip ${index + 1}`,
      student.name,
      student.type
    ]))
  ];
  const csv = rows.map(row => row.map(csvEscape).join(';')).join('\n');
  // Afegim el Byte Order Mark (BOM) UTF-8 (\uFEFF) al davant perquè l'Excel reconegui correctament les accentuacions catalanes
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `synapp-equips-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setSaveState('CSV exportat', 'connected');
}

function exportTeamsExcel() {
  const teams = state.lastTeams || [];
  if (teams.length === 0) return;

  const selectedClass = state.classes.find(item => item.id === state.selectedClassId);
  const className = selectedClass ? selectedClass.name : 'Classe';
  
  // Format de la data a la inversa amb punts: YYYY.MM.DD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const stamp = `${year}.${month}.${day}`;

  // Crear un nou llibre de treball (workbook) de SheetJS
  const wb = XLSX.utils.book_new();

  // Funció per calcular les amplades de les columnes automàticament i aplicar-les de forma polida
  function autoFitColumns(ws, data) {
    if (!data || data.length === 0) return;
    const colWidths = data[0].map((_, colIdx) => {
      return Math.max(...data.map(row => {
        const val = row[colIdx];
        return val ? String(val).length : 0;
      }), 12); // amplada mínima de 12 caràcters per defecte
    });
    ws['!cols'] = colWidths.map(w => ({ wch: w + 4 })); // marge de 4 caràcters per evitar tallar text
  }

  // 1. PESTANYA: Llista de grups
  const listData = [
    ['SYNAPP - GENERADOR DE GRUPS COOPERATIUS'],
    [`Classe: ${className} | Data d'exportació: ${stamp}`],
    [], // fila buida de separació
    ['GRUP', 'NOM DE L\'ALUMNE', 'TIPOLOGIA']
  ];
  teams.forEach((team, index) => {
    team.forEach(student => {
      listData.push([`Grup ${index + 1}`, student.name, student.type]);
    });
  });
  const wsList = XLSX.utils.aoa_to_sheet(listData);
  autoFitColumns(wsList, listData.slice(3)); // usem només des dels títols del llistat
  XLSX.utils.book_append_sheet(wb, wsList, 'Llista de grups');

  // 2. PESTANYA: Grups en columnes (obviant tipologies)
  const maxTeamSize = Math.max(...teams.map(t => t.length), 0);
  const columnsData = [
    ['SYNAPP - DISTRIBUCIÓ DE GRUPS EN COLUMNES'],
    [`Classe: ${className} | Data d'exportació: ${stamp}`],
    [], // fila buida
  ];
  
  // Capçalera amb els noms dels grups en majúscules (GRUP 1, GRUP 2...)
  const headersCols = teams.map((_, index) => `GRUP ${index + 1}`);
  columnsData.push(headersCols);
  
  // Integrants de cada grup de dalt a baix (només els noms)
  for (let r = 0; r < maxTeamSize; r++) {
    const row = [];
    teams.forEach(team => {
      const student = team[r];
      row.push(student ? student.name : '');
    });
    columnsData.push(row);
  }
  const wsColumns = XLSX.utils.aoa_to_sheet(columnsData);
  autoFitColumns(wsColumns, columnsData.slice(3));
  XLSX.utils.book_append_sheet(wb, wsColumns, 'Grups en columnes');

  // 3. PESTANYA: Grups en files (obviant tipologies)
  const filesData = [
    ['SYNAPP - DISTRIBUCIÓ DE GRUPS EN FILES'],
    [`Classe: ${className} | Data d'exportació: ${stamp}`],
    [], // fila buida
  ];
  
  // Capçalera en majúscules (GRUP, ALUMNE 1, ALUMNE 2...)
  const headersRows = ['GRUP'];
  for (let i = 1; i <= maxTeamSize; i++) {
    headersRows.push(`ALUMNE ${i}`);
  }
  filesData.push(headersRows);
  
  // Integrants de cada grup en format horitzontal (només els noms)
  teams.forEach((team, index) => {
    const row = [`Grup ${index + 1}`];
    for (let i = 0; i < maxTeamSize; i++) {
      const student = team[i];
      row.push(student ? student.name : '');
    }
    filesData.push(row);
  });
  const wsRows = XLSX.utils.aoa_to_sheet(filesData);
  autoFitColumns(wsRows, filesData.slice(3));
  XLSX.utils.book_append_sheet(wb, wsRows, 'Grups en files');

  // Generar la descàrrega del fitxer Excel
  const cleanClassName = normalise(className).replace(/\s+/g, '-');
  const filename = `synapp-grups-${cleanClassName}-${stamp}.xlsx`;
  XLSX.writeFile(wb, filename);
  setSaveState('Excel exportat', 'connected');
}

async function saveTeamsRemote() {
  if (!APPS_SCRIPT_URL) {
    setSaveState('Pendent de connexió amb Google Sheets', 'pending');
    return;
  }
  const teams = state.lastTeams || [];
  if (teams.length === 0) return;
  setSaveState('Desant al Sheets...', 'pending');
  try {
    const payload = await apiPost('saveTeams', {
      classId: state.selectedClassId,
      size: Number(els.teamSize.value),
      mode: els.teamMode.value,
      score: state.lastReport?.score || '',
      teams
    });
    if (!payload.ok) throw new Error(payload.error || 'No saved');
    setSaveState('Desat al Google Sheets', 'connected');
  } catch (error) {
    setSaveState('Error desant al Sheets', 'error');
  }
}

async function saveStudentTypeRemote(student) {
  if (!APPS_SCRIPT_URL) return;
  try {
    await apiPost('saveStudentType', {
      classId: student.classId,
      studentId: student.id,
      type: student.type
    });
  } catch (error) {
    setSaveState('Canvi local pendent de desar', 'pending');
  }
}

async function saveStudentActiveRemote(student) {
  if (!APPS_SCRIPT_URL) return;
  setSaveState('Desant estat...', 'pending');
  try {
    const payload = await apiPost('saveStudentActive', {
      classId: student.classId,
      studentId: student.id,
      active: student.active
    });
    if (!payload.ok) throw new Error(payload.error || 'No saved');
    setSaveState(student.active ? 'Alumne activat al Sheets' : 'Alumne inactiu al Sheets', 'connected');
  } catch (error) {
    setSaveState('Canvi local pendent de desar', 'pending');
  }
}

async function apiPost(action, payload) {
  return new Promise((resolve, reject) => {
    const callback = `__synapp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const query = new URLSearchParams({
      key: ACCESS_KEY,
      action,
      payload: JSON.stringify(payload || {}),
      callback
    });
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Temps d’espera superat'));
    }, API_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callback];
      script.remove();
    }

    window[callback] = data => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('No s’ha pogut contactar amb Apps Script'));
    };
    script.src = `${APPS_SCRIPT_URL}?${query.toString()}`;
    document.head.appendChild(script);
  });
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function countTypes(students) {
  return students.reduce((acc, student) => {
    acc[student.type] = (acc[student.type] || 0) + 1;
    return acc;
  }, { A: 0, B: 0, C: 0 });
}

function dominantType(students) {
  const counts = countTypes(students);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function namesFor(ids) {
  return ids.map(id => studentById(id)?.name).filter(Boolean).join(', ');
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalise(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

