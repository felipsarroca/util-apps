(function () {
  const STORAGE_KEY = "massa-horaria-static-state-v2";
  const API_TOKEN_KEY = "massa-horaria-api-token-v1";
  const PENDING_WRITES_KEY = "massa-horaria-pending-writes-v1";
  const REMOTE_API_URL = String(window.MASSA_APPS_SCRIPT_API_URL || "").trim();
  const pendingWrites = [];
  const ASSIGNMENT_TYPES = {
    CLASSE: { label: "Classe", coverageFactor: 1 },
    REFORC: { label: "Reforç", coverageFactor: 0 },
    DESDOBLAMENT: { label: "Desdoblament", coverageFactor: 0.5 },
    COMPLEMENTARIA: { label: "Complementària", coverageFactor: 1 },
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    const random = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${random}`;
  }

  function safeParse(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function hasRemoteApi() {
    return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(REMOTE_API_URL);
  }

  function apiToken() {
    try {
      return window.sessionStorage.getItem(API_TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function setApiToken(token) {
    try {
      if (token) window.sessionStorage.setItem(API_TOKEN_KEY, token);
    } catch {
      // sessionStorage pot no estar disponible en algun navegador restrictiu.
    }
  }

  function pendingCellKey(payload) {
    return [
      String(payload?.courseId || ""),
      String(payload?.subjectId || ""),
      String(payload?.teacherId || ""),
    ].join("::");
  }

  function readPendingWrites() {
    try {
      const parsed = safeParse(window.localStorage.getItem(PENDING_WRITES_KEY));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writePendingWrites(items) {
    try {
      window.localStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(items));
    } catch {
      // Si no hi ha localStorage, la sincronització continua en la sessió actual.
    }
  }

  function rememberPendingCellWrite(payload) {
    const next = {
      key: pendingCellKey(payload),
      payload: {
        courseId: String(payload?.courseId || ""),
        subjectId: String(payload?.subjectId || ""),
        teacherId: String(payload?.teacherId || ""),
        entries: Array.isArray(payload?.entries)
          ? payload.entries.map((entry) => ({
              type: String(entry?.type || "").toUpperCase(),
              hours: Number(entry?.hours || 0),
            }))
          : [],
      },
      updatedAt: Date.now(),
    };
    const items = readPendingWrites().filter((item) => item.key !== next.key);
    items.push(next);
    writePendingWrites(items);
  }

  function sameCell(item, payload) {
    return String(item.courseId) === String(payload.courseId) &&
      String(item.subjectId) === String(payload.subjectId) &&
      String(item.teacherId) === String(payload.teacherId);
  }

  function assignmentSignature(items) {
    return (items || [])
      .map((item) => `${String(item.type).toUpperCase()}:${Number(item.hours || 0)}`)
      .sort()
      .join("|");
  }

  function pendingConfirmed(data, pending) {
    const actual = (data.assignments || []).filter((item) => sameCell(item, pending.payload));
    return assignmentSignature(actual) === assignmentSignature(pending.payload.entries);
  }

  function overlayPendingWrites(data) {
    const pending = readPendingWrites();
    if (!pending.length || !data) return data;
    const remaining = [];
    let assignments = Array.isArray(data.assignments) ? data.assignments.slice() : [];

    pending.forEach((item) => {
      if (pendingConfirmed(data, item)) return;
      remaining.push(item);
      assignments = assignments.filter((assignment) => !sameCell(assignment, item.payload));
      assignments = assignments.concat(optimisticCellAssignments(item.payload).assignments);
      if (Date.now() - Number(item.lastSentAt || 0) > 30000) {
        item.lastSentAt = Date.now();
        sendRemoteApiWrite("saveCellAssignments", item.payload);
      }
    });

    writePendingWrites(remaining);
    data.assignments = assignments;
    return data;
  }

  function callRemoteApi(method, payload) {
    return new Promise((resolve, reject) => {
      const callbackName = `__massaApi_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const script = document.createElement("script");
      const url = new URL(REMOTE_API_URL);
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("No s'ha pogut contactar amb Google Sheets."));
      }, 30000);

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = (response) => {
        cleanup();
        if (response && response.token) setApiToken(response.token);
        resolve(response);
      };

      url.searchParams.set("api", "1");
      url.searchParams.set("method", method);
      url.searchParams.set("callback", callbackName);
      url.searchParams.set("payload", JSON.stringify(payload || {}));
      const token = apiToken();
      if (token) url.searchParams.set("token", token);
      script.onerror = () => {
        cleanup();
        reject(new Error("No s'ha pogut carregar l'API de Google Sheets."));
      };
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  function sendRemoteApiWrite(method, payload) {
    if (!hasRemoteApi()) return;
    const callbackName = `__massaWrite_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const url = new URL(REMOTE_API_URL);
    url.searchParams.set("api", "1");
    url.searchParams.set("method", method);
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("payload", JSON.stringify(payload || {}));
    const token = apiToken();
    if (token) url.searchParams.set("token", token);

    const script = document.createElement("script");
    const cleanup = () => {
      const index = pendingWrites.indexOf(script);
      if (index >= 0) pendingWrites.splice(index, 1);
      delete window[callbackName];
      script.remove();
    };
    window[callbackName] = cleanup;
    script.onerror = cleanup;
    script.async = true;
    script.src = url.toString();
    pendingWrites.push(script);
    document.head.appendChild(script);
    window.setTimeout(cleanup, 180000);
  }

  function optimisticCellAssignments(payload) {
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    return {
      ok: true,
      assignments: entries.map((entry, index) => {
        const type = String(entry?.type || "").toUpperCase();
        return {
          id: `pending-${Date.now()}-${index}`,
          courseId: String(payload.courseId || ""),
          subjectId: String(payload.subjectId || ""),
          teacherId: String(payload.teacherId || ""),
          type,
          hours: Number(entry?.hours || 0),
          coverageFactor: ASSIGNMENT_TYPES[type]?.coverageFactor || 0,
          notes: "",
        };
      }),
    };
  }

  function saveCellAssignmentsRemote(payload) {
    rememberPendingCellWrite(payload);
    sendRemoteApiWrite("saveCellAssignments", payload);
    return optimisticCellAssignments(payload);
  }

  function getApplicationDataRemote(payload) {
    return callRemoteApi("getApplicationData", payload).then((response) => {
      if (response && response.ok && response.data) {
        response.data = overlayPendingWrites(response.data);
      }
      return response;
    });
  }

  function remoteOrLocal(method, localMethod) {
    return (payload) => {
      if (hasRemoteApi()) return callRemoteApi(method, payload);
      return localMethod(payload);
    };
  }

  function normalizeState(raw) {
    const seed = window.SEED_DATA || {};
    const years = Array.isArray(raw?.academicYears) && raw.academicYears.length
      ? raw.academicYears
      : [clone(raw?.academicYear || seed.academicYear || { id: "curs-2025-26", nom: "2025-26", estat: "ESBORRANY", actiu: true })];
    const activeYearId = raw?.activeAcademicYearId || years[0]?.id;
    const buckets = raw?.yearBuckets && typeof raw.yearBuckets === "object"
      ? raw.yearBuckets
      : {};

    if (!buckets[activeYearId]) {
      const base = raw?.yearBucket || {};
      buckets[activeYearId] = {
        courses: clone(raw?.courses || base.courses || seed.courses || []),
        plans: clone(raw?.plans || base.plans || seed.plans || []),
        assignments: clone(raw?.assignments || base.assignments || seed.assignments || []),
        contracts: clone(raw?.contracts || base.contracts || seed.contracts || []),
        rules: clone(raw?.rules || base.rules || seed.rules || []),
        chargeAssignments: clone(raw?.chargeAssignments || base.chargeAssignments || seed.chargeAssignments || []),
      };
    }

    return {
      academicYears: years.map((year) => ({
        id: String(year.id || year.Id || year.ID),
        name: String(year.name || year.nom || year.Nom || ""),
        status: String(year.status || year.estat || year.Estat || "ESBORRANY"),
        active: year.active !== false && year.actiu !== false,
      })),
      activeAcademicYearId: String(activeYearId || years[0]?.id || ""),
      teachers: clone(raw?.teachers || seed.teachers || []),
      subjects: clone(raw?.subjects || seed.subjects || []),
      charges: clone(raw?.charges || seed.charges || []),
      yearBuckets: buckets,
    };
  }

  function createInitialState(seed) {
    const academicYearSeed = seed?.academicYear || { id: "curs-2025-26", nom: "2025-26", estat: "ESBORRANY", actiu: true };
    const academicYear = {
      id: String(academicYearSeed.id || academicYearSeed.Id || "curs-2025-26"),
      name: String(academicYearSeed.name || academicYearSeed.nom || "2025-26"),
      status: String(academicYearSeed.status || academicYearSeed.estat || "ESBORRANY"),
      active: academicYearSeed.active !== false && academicYearSeed.actiu !== false,
    };
    return normalizeState({
      academicYears: [academicYear],
      activeAcademicYearId: academicYear.id,
      teachers: clone(seed?.teachers || []).map((item) => ({
        id: String(item.id || item.Id),
        firstName: String(item.nom || item.firstName || ""),
        lastName1: String(item.cognom1 || item.lastName1 || ""),
        lastName2: String(item.cognom2 || item.lastName2 || ""),
        name: String(item.nomComplet || item.name || ""),
        active: item.actiu !== false && item.active !== false,
      })),
      subjects: clone(seed?.subjects || []).map((item) => ({
        id: String(item.id || item.Id),
        name: String(item.nom || item.name || ""),
        shortName: String(item.nomCurt || item.shortName || item.nom || item.name || ""),
        active: item.activa !== false && item.active !== false,
      })),
      charges: clone(seed?.charges || []).map((item) => ({
        id: String(item.id || item.Id),
        name: String(item.nom || item.name || ""),
        order: Number(item.ordre || item.order || 0),
        active: item.actiu !== false && item.active !== false,
      })),
      yearBuckets: {
        [academicYear.id]: {
          courses: clone(seed?.courses || []).map((item) => ({
            id: String(item.id || item.Id),
            code: String(item.codi || item.code || ""),
            name: String(item.nom || item.name || ""),
            stage: String(item.etapa || item.stage || ""),
            order: Number(item.ordre || item.order || 0),
            targetHours: Number(item.horesObjectiu || item.targetHours || 0),
            active: item.actiu !== false && item.active !== false,
          })),
          plans: clone(seed?.plans || []).map((item) => ({
            id: String(item.id || item.Id),
            courseId: String(item.grupId || item.courseId || ""),
            subjectId: String(item.materiaId || item.subjectId || ""),
            order: Number(item.ordre || item.order || 0),
            targetHours: Number(item.horesObjectiu || item.targetHours || 0),
            baseType: String(item.tipusBase || item.baseType || "CLASSE"),
            active: item.actiu !== false && item.active !== false,
          })),
          assignments: clone(seed?.assignments || []).map((item) => ({
            id: String(item.id || item.Id),
            courseId: String(item.grupId || item.courseId || ""),
            subjectId: String(item.materiaId || item.subjectId || ""),
            teacherId: String(item.professorId || item.teacherId || ""),
            type: String(item.tipus || item.type || "CLASSE"),
            hours: Number(item.hores || item.hours || 0),
            coverageFactor: Number(item.factorCobertura || item.coverageFactor || 0),
            notes: String(item.observacions || item.notes || ""),
            active: item.activa !== false && item.active !== false,
          })),
          contracts: clone(seed?.contracts || []).map((item) => ({
            id: String(item.id || item.Id),
            teacherId: String(item.professorId || item.teacherId || ""),
            hours: Number(item.hores || item.hours || 0),
            active: item.actiu !== false && item.active !== false,
          })),
          rules: clone(seed?.rules || []).map((item) => ({
            id: String(item.id || item.Id),
            stage: String(item.etapa || item.stage || ""),
            hdcRate: Number(item.percentatgeHdc || item.hdcRate || 0),
            active: item.actiu !== false && item.active !== false,
          })),
          chargeAssignments: clone(seed?.chargeAssignments || []).map((item) => ({
            id: String(item.id || item.Id),
            teacherId: String(item.professorId || item.teacherId || ""),
            chargeId: String(item.carrecId || item.chargeId || ""),
            hours: Number(item.hores || item.hours || 0),
            active: item.activa !== false && item.active !== false,
          })),
        },
      },
    });
  }

  function readState() {
    const fallback = createInitialState(window.SEED_DATA);
    if (!window.localStorage) return fallback;
    const stored = safeParse(window.localStorage.getItem(STORAGE_KEY));
    const state = stored ? normalizeState(stored) : fallback;
    if (!stored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    return state;
  }

  function writeState(state) {
    if (!window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
  }

  function getYear(state, yearId) {
    const id = String(yearId || state.activeAcademicYearId || state.academicYears[0]?.id || "");
    let year = state.academicYears.find((item) => String(item.id) === id);
    if (!year && state.academicYears.length) {
      year = state.academicYears[0];
      state.activeAcademicYearId = year.id;
    }
    return year || null;
  }

  function getBucket(state, yearId) {
    const id = String(yearId || state.activeAcademicYearId || "");
    if (!state.yearBuckets[id]) {
      state.yearBuckets[id] = {
        courses: [],
        plans: [],
        assignments: [],
        contracts: [],
        rules: [],
        chargeAssignments: [],
      };
    }
    return state.yearBuckets[id];
  }

  function yearName(value) {
    const match = String(value || "").match(/^(\d{4}|\d{2})-(\d{2}|\d{4})$/);
    if (!match) return "curs-següent";
    const first = Number(match[1]);
    const firstFull = first < 100 ? 2000 + first : first;
    const nextFirst = firstFull + 1;
    return `${nextFirst}-${String((nextFirst + 1) % 100).padStart(2, "0")}`;
  }

  function buildData(state) {
    const activeYear = getYear(state);
    if (!activeYear) {
      throw new Error("No hi ha cap curs escolar actiu.");
    }
    const bucket = getBucket(state, activeYear.id);
    const teachers = clone(state.teachers || [])
      .filter((item) => item.active !== false)
      .map((item) => ({
        id: String(item.id),
        firstName: String(item.firstName || ""),
        lastName1: String(item.lastName1 || ""),
        lastName2: String(item.lastName2 || ""),
        name: String(item.name || [item.firstName, item.lastName1, item.lastName2].filter(Boolean).join(" ")),
        active: item.active !== false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ca"));
    const courses = clone(bucket.courses || [])
      .filter((item) => item.active !== false)
      .map((item) => ({
        id: String(item.id),
        code: String(item.code || ""),
        name: String(item.name || ""),
        stage: String(item.stage || ""),
        order: Number(item.order || 0),
        targetHours: Number(item.targetHours || 0),
        active: item.active !== false,
      }))
      .sort((a, b) => a.order - b.order);
    const subjects = Object.fromEntries(
      clone(state.subjects || [])
        .filter((item) => item.active !== false)
        .map((item) => [
          String(item.id),
          {
            id: String(item.id),
            name: String(item.name || ""),
            shortName: String(item.shortName || item.name || ""),
            active: item.active !== false,
          },
        ])
    );
    const plans = clone(bucket.plans || [])
      .filter((item) => item.active !== false)
      .map((item) => ({
        id: String(item.id),
        courseId: String(item.courseId),
        subjectId: String(item.subjectId),
        order: Number(item.order || 0),
        targetHours: Number(item.targetHours || 0),
        baseType: String(item.baseType || "CLASSE"),
        active: item.active !== false,
      }))
      .sort((a, b) => a.order - b.order);
    const assignments = clone(bucket.assignments || [])
      .filter((item) => item.active !== false)
      .map((item) => ({
        id: String(item.id),
        courseId: String(item.courseId),
        subjectId: String(item.subjectId),
        teacherId: String(item.teacherId),
        type: String(item.type),
        hours: Number(item.hours || 0),
        coverageFactor: Number(item.coverageFactor || 0),
        notes: String(item.notes || ""),
      }));
    const contracts = clone(bucket.contracts || [])
      .filter((item) => item.active !== false)
      .map((item) => ({
        id: String(item.id),
        teacherId: String(item.teacherId),
        hours: Number(item.hours || 0),
      }));
    const rules = clone(bucket.rules || [])
      .filter((item) => item.active !== false)
      .map((item) => ({
        id: String(item.id),
        stage: String(item.stage || ""),
        hdcRate: Number(item.hdcRate || 0),
        active: item.active !== false,
      }));
    const charges = clone(state.charges || [])
      .filter((item) => item.active !== false)
      .map((item) => ({
        id: String(item.id),
        name: String(item.name || ""),
        order: Number(item.order || 0),
        active: item.active !== false,
      }))
      .sort((a, b) => a.order - b.order);
    const chargeAssignments = clone(bucket.chargeAssignments || [])
      .filter((item) => item.active !== false)
      .map((item) => ({
        id: String(item.id),
        teacherId: String(item.teacherId),
        chargeId: String(item.chargeId),
        hours: Number(item.hours || 0),
        active: item.active !== false,
      }));

    return {
      app: { name: "Massa horaria", subtitle: "Escola Ramon Pont", version: "static" },
      user: { email: "github-pages@local", name: "Sessi\u00f3 local", role: "ADMIN" },
      activeYear: { id: String(activeYear.id), name: String(activeYear.name), status: String(activeYear.status) },
      academicYears: clone(state.academicYears || []).map((item) => ({
        id: String(item.id),
        name: String(item.name || ""),
        status: String(item.status || ""),
        active: item.active !== false,
      })),
      teachers,
      courses,
      subjects,
      plans,
      assignments,
      contracts,
      rules,
      charges,
      chargeAssignments,
      assignmentTypes: ASSIGNMENT_TYPES,
    };
  }

  function setField(target, values) {
    Object.keys(values).forEach((key) => {
      target[key] = values[key];
    });
  }

  function upsertById(list, id, values) {
    const index = list.findIndex((item) => String(item.id) === String(id));
    if (index >= 0) {
      setField(list[index], values);
      return list[index];
    }
    const record = { id, ...values };
    list.push(record);
    return record;
  }

  function removeByPredicate(list, predicate) {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (predicate(list[index])) list.splice(index, 1);
    }
  }

  function cloneYearBucket(sourceBucket, targetSuffix, courseMap) {
    const renameId = (value) => `${String(value)}-${targetSuffix}`;
    return {
      courses: clone(sourceBucket.courses || []).map((item) => {
        const next = clone(item);
        courseMap[String(item.id)] = renameId(item.id);
        next.id = renameId(item.id);
        return next;
      }),
      plans: clone(sourceBucket.plans || []).map((item) => {
        const next = clone(item);
        next.id = renameId(item.id);
        next.courseId = courseMap[String(item.courseId)] || String(item.courseId);
        return next;
      }),
      assignments: clone(sourceBucket.assignments || []).map((item, index) => {
        const next = clone(item);
        next.id = `${renameId(item.id)}-${String(index + 1).padStart(3, "0")}`;
        next.courseId = courseMap[String(item.courseId)] || String(item.courseId);
        return next;
      }),
      contracts: clone(sourceBucket.contracts || []).map((item) => ({
        ...clone(item),
        id: renameId(item.id),
      })),
      rules: clone(sourceBucket.rules || []).map((item) => ({
        ...clone(item),
        id: renameId(item.id),
      })),
      chargeAssignments: clone(sourceBucket.chargeAssignments || []).map((item) => ({
        ...clone(item),
        id: renameId(item.id),
      })),
    };
  }

  function saveCellAssignments(payload) {
    const state = readState();
    const year = getYear(state);
    if (!year) throw new Error("No hi ha cap curs escolar actiu.");
    const bucket = getBucket(state, year.id);
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    const sameCell = (item) =>
      String(item.courseId) === String(payload.courseId) &&
      String(item.subjectId) === String(payload.subjectId) &&
      String(item.teacherId) === String(payload.teacherId);

    removeByPredicate(bucket.assignments, (item) => sameCell(item));
    const saved = entries.map((entry) => {
      const type = String(entry?.type || "").toUpperCase();
      const hours = Number(entry?.hours || 0);
      if (!ASSIGNMENT_TYPES[type]) throw new Error("Tipus d'assignació no vàlid.");
      if (!Number.isFinite(hours) || hours <= 0 || hours > 60) throw new Error("Hores no vàlides.");
      const record = {
        id: uid("ass"),
        courseId: String(payload.courseId),
        subjectId: String(payload.subjectId),
        teacherId: String(payload.teacherId),
        type,
        hours,
        coverageFactor: ASSIGNMENT_TYPES[type].coverageFactor,
        notes: "",
        active: true,
      };
      bucket.assignments.push(record);
      return {
        id: record.id,
        courseId: record.courseId,
        subjectId: record.subjectId,
        teacherId: record.teacherId,
        type: record.type,
        hours: record.hours,
        coverageFactor: record.coverageFactor,
        notes: record.notes,
      };
    });
    writeState(state);
    return { ok: true, assignments: saved };
  }

  function saveTeacher(payload) {
    const state = readState();
    const year = getYear(state);
    if (!year) throw new Error("No hi ha cap curs escolar actiu.");
    const bucket = getBucket(state, year.id);
    const id = String(payload?.id || uid("prof"));
    const firstName = String(payload?.firstName || "").trim();
    const lastName1 = String(payload?.lastName1 || "").trim();
    const lastName2 = String(payload?.lastName2 || "").trim();
    if (!firstName || !lastName1) throw new Error("Cal indicar el nom i el primer cognom.");
    upsertById(state.teachers, id, {
      firstName,
      lastName1,
      lastName2,
      name: [firstName, lastName1, lastName2].filter(Boolean).join(" "),
      active: payload?.active !== false,
    });

    const contractHours = Number(payload?.contractHours || 0);
    upsertById(bucket.contracts, `con-${id}`, {
      teacherId: id,
      hours: contractHours,
      active: contractHours > 0,
    });

    const requested = new Map(
      Array.isArray(payload?.charges)
        ? payload.charges
            .map((item) => [String(item.chargeId), Number(item.hours || 0)])
            .filter(([, hours]) => Number.isFinite(hours) && hours > 0)
        : []
    );
    removeByPredicate(bucket.chargeAssignments, (item) => String(item.teacherId) === id);
    requested.forEach((hours, chargeId) => {
      bucket.chargeAssignments.push({
        id: uid("ac"),
        teacherId: id,
        chargeId,
        hours,
        notes: "",
        active: true,
      });
    });

    writeState(state);
    return { ok: true, id };
  }

  function saveCourse(payload) {
    const state = readState();
    const year = getYear(state);
    if (!year) throw new Error("No hi ha cap curs escolar actiu.");
    const bucket = getBucket(state, year.id);
    const id = String(payload?.id || uid("grup"));
    const code = String(payload?.code || "").trim();
    const name = String(payload?.name || "").trim();
    const stage = String(payload?.stage || "");
    const order = Number(payload?.order || 0);
    const targetHours = Number(payload?.targetHours || 0);
    if (!code || !name) throw new Error("Cal indicar el codi i el nom.");
    upsertById(bucket.courses, id, {
      code,
      name,
      stage,
      order,
      targetHours,
      active: payload?.active !== false,
    });
    writeState(state);
    return { ok: true, id };
  }

  function saveSubject(payload) {
    const state = readState();
    const id = String(payload?.id || uid("mat"));
    const name = String(payload?.name || "").trim();
    if (!name) throw new Error("Cal indicar el nom.");
    upsertById(state.subjects, id, {
      name,
      shortName: String(payload?.shortName || name).trim(),
      active: payload?.active !== false,
    });
    writeState(state);
    return { ok: true, id };
  }

  function savePlan(payload) {
    const state = readState();
    const year = getYear(state);
    if (!year) throw new Error("No hi ha cap curs escolar actiu.");
    const bucket = getBucket(state, year.id);
    const id = String(payload?.id || uid("pla"));
    upsertById(bucket.plans, id, {
      courseId: String(payload?.courseId || ""),
      subjectId: String(payload?.subjectId || ""),
      order: Number(payload?.order || 0),
      targetHours: Number(payload?.targetHours || 0),
      baseType: String(payload?.baseType || "CLASSE"),
      active: payload?.active !== false,
    });
    writeState(state);
    return { ok: true, id };
  }

  function saveCharge(payload) {
    const state = readState();
    const id = String(payload?.id || uid("car"));
    const name = String(payload?.name || "").trim();
    if (!name) throw new Error("Cal indicar el nom.");
    upsertById(state.charges, id, {
      name,
      order: Number(payload?.order || 0),
      active: payload?.active !== false,
    });
    writeState(state);
    return { ok: true, id };
  }

  function saveRule(payload) {
    const state = readState();
    const year = getYear(state);
    if (!year) throw new Error("No hi ha cap curs escolar actiu.");
    const bucket = getBucket(state, year.id);
    const id = String(payload?.id || uid("reg"));
    const hdcRate = Number(payload?.hdcRate || 0);
    if (!Number.isFinite(hdcRate) || hdcRate < 0 || hdcRate > 1) {
      throw new Error("El percentatge HDC ha d'estar entre 0 i 1.");
    }
    upsertById(bucket.rules, id, {
      stage: String(payload?.stage || ""),
      hdcRate,
      active: payload?.active !== false,
    });
    writeState(state);
    return { ok: true, id };
  }

  function saveAcademicYearStatus(payload) {
    const state = readState();
    const id = String(payload?.id || "");
    const status = String(payload?.status || "").toUpperCase();
    if (!["ESBORRANY", "EN_PROCES", "ACTIU", "TANCAT"].includes(status)) {
      throw new Error("L'estat del curs no és vàlid.");
    }
    const year = state.academicYears.find((item) => String(item.id) === id);
    if (!year) throw new Error("No s'ha trobat el curs escolar.");
    year.status = status;
    year.active = true;
    state.activeAcademicYearId = id;
    writeState(state);
    return { ok: true, id, status };
  }

  function createNextAcademicYear(payload) {
    const state = readState();
    const sourceName = String(payload?.sourceName || getYear(state)?.name || "");
    const targetName = String(payload?.targetName || yearName(sourceName));
    const source = state.academicYears.find((item) => String(item.name) === sourceName);
    if (!source) throw new Error(`No existeix el curs ${sourceName}.`);
    const existingTarget = state.academicYears.find((item) => String(item.name) === targetName);
    if (existingTarget) {
      state.activeAcademicYearId = existingTarget.id;
      writeState(state);
      return { ok: true, created: false, id: existingTarget.id };
    }

    const suffix = targetName.replace(/[^0-9a-z]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    const sourceBucket = getBucket(state, source.id);
    const courseMap = {};
    const targetBucket = cloneYearBucket(sourceBucket, suffix, courseMap);
    const targetId = `curs-${suffix || targetName}`;
    state.academicYears.forEach((item) => {
      if (String(item.id) === String(source.id)) item.status = "TANCAT";
    });
    state.academicYears.push({ id: targetId, name: targetName, status: "ESBORRANY", active: true });
    state.yearBuckets[targetId] = targetBucket;
    state.activeAcademicYearId = targetId;
    writeState(state);
    return { ok: true, created: true, id: targetId };
  }

  function getApplicationData() {
    return { ok: true, data: buildData(readState()) };
  }

  function verifyAccessPasscode(payload) {
    const ok = String(payload?.passcode || "") === "SoL";
    return { ok, error: ok ? "" : "La clau de pas no és correcta." };
  }

  window.__MASSA_STATIC_BACKEND__ = {
    getApplicationData: hasRemoteApi() ? getApplicationDataRemote : getApplicationData,
    verifyAccessPasscode: remoteOrLocal("verifyAccessPasscode", verifyAccessPasscode),
    saveCellAssignments: hasRemoteApi() ? saveCellAssignmentsRemote : saveCellAssignments,
    saveTeacher: remoteOrLocal("saveTeacher", saveTeacher),
    saveCourse: remoteOrLocal("saveCourse", saveCourse),
    saveSubject: remoteOrLocal("saveSubject", saveSubject),
    savePlan: remoteOrLocal("savePlan", savePlan),
    saveCharge: remoteOrLocal("saveCharge", saveCharge),
    saveRule: remoteOrLocal("saveRule", saveRule),
    saveAcademicYearStatus: remoteOrLocal("saveAcademicYearStatus", saveAcademicYearStatus),
    createNextAcademicYear: remoteOrLocal("createNextAcademicYear", createNextAcademicYear),
  };
})();
