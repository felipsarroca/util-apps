function getApplicationData() {
  try {
    const user = requireWebAccess_(requireUser_(APP_CONFIG.allowedRoles));
    return { ok: true, data: buildApplicationData_(user) };
  } catch (error) {
    return publicError_(error);
  }
}

function buildApplicationData_(user) {
  const years = readTable_("CursosEscolars").filter((item) => toBoolean_(item.Actiu));
  const configuration = readTable_("Configuracio");
  const configuredYearId = String(
    (configuration.find((item) => String(item.Clau) === "ACTIVE_ACADEMIC_YEAR_ID") || {}).Valor || ""
  );
  const activeYear =
    years.find((item) => String(item.Id) === configuredYearId) ||
    years.find((item) => String(item.Estat) === "ESBORRANY") ||
    years.find((item) => String(item.Estat) === "EN_PROCES") ||
    years[0] ||
    null;
  if (!activeYear) {
    throw new Error("No hi ha cap curs escolar actiu.");
  }
  const yearId = String(activeYear.Id);
  const teachers = readTable_("Professorat")
    .filter((item) => toBoolean_(item.Actiu))
    .map((item) => ({
      id: String(item.Id),
      firstName: String(item.Nom || ""),
      lastName1: String(item.Cognom1 || ""),
      lastName2: String(item.Cognom2 || ""),
      name: String(item.NomComplet),
      active: toBoolean_(item.Actiu),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ca"));
  const courses = readTable_("Grups")
    .filter((item) => String(item.CursEscolarId) === yearId && toBoolean_(item.Actiu))
    .map((item) => ({
      id: String(item.Id),
      code: String(item.Codi),
      name: String(item.Nom),
      stage: String(item.Etapa),
      order: Number(item.Ordre),
      targetHours: Number(item.HoresObjectiu),
    }))
    .sort((a, b) => a.order - b.order);
  const subjects = readTable_("Materies").reduce((map, item) => {
    map[String(item.Id)] = {
      id: String(item.Id),
      name: String(item.Nom),
      shortName: String(item.NomCurt || item.Nom),
      active: toBoolean_(item.Activa),
    };
    return map;
  }, {});
  const plans = readTable_("PlaEstudis")
    .filter((item) => String(item.CursEscolarId) === yearId && toBoolean_(item.Actiu))
    .map((item) => ({
      id: String(item.Id),
      courseId: String(item.GrupId),
      subjectId: String(item.MateriaId),
      order: Number(item.Ordre),
      targetHours: Number(item.HoresObjectiu),
      baseType: String(item.TipusBase),
      active: toBoolean_(item.Actiu),
    }));
  const assignments = readTable_("Assignacions")
    .filter((item) => String(item.CursEscolarId) === yearId && toBoolean_(item.Activa))
    .map((item) => ({
      id: String(item.Id),
      courseId: String(item.GrupId),
      subjectId: String(item.MateriaId),
      teacherId: String(item.ProfessorId),
      type: String(item.Tipus),
      hours: Number(item.Hores),
      coverageFactor: Number(item.FactorCobertura),
      notes: String(item.Observacions || ""),
    }));
  const contracts = readTable_("Contractes")
    .filter((item) => String(item.CursEscolarId) === yearId && toBoolean_(item.Actiu))
    .map((item) => ({
      teacherId: String(item.ProfessorId),
      hours: Number(item.Hores),
    }));
  const rules = readTable_("ReglesComput")
    .filter((item) => String(item.CursEscolarId) === yearId && toBoolean_(item.Actiu))
    .map((item) => ({
      id: String(item.Id),
      stage: String(item.Etapa),
      hdcRate: Number(item.PercentatgeHdc),
      active: toBoolean_(item.Actiu),
    }));
  const chargeAssignments = readTable_("AssignacionsCarrecs")
    .filter((item) => String(item.CursEscolarId) === yearId && toBoolean_(item.Activa))
    .map((item) => ({
      id: String(item.Id),
      teacherId: String(item.ProfessorId),
      chargeId: String(item.CarrecId),
      hours: Number(item.Hores),
      active: toBoolean_(item.Activa),
    }));
  const charges = readTable_("Carrecs")
    .map((item) => ({
      id: String(item.Id),
      name: String(item.Nom),
      order: Number(item.Ordre),
      active: toBoolean_(item.Actiu),
    }))
    .sort((a, b) => a.order - b.order);

  return {
    app: {
      name: APP_CONFIG.name,
      subtitle: APP_CONFIG.subtitle,
      version: APP_CONFIG.version,
    },
    user: user,
    activeYear: { id: yearId, name: String(activeYear.Nom), status: String(activeYear.Estat) },
    academicYears: years.map((item) => ({
      id: String(item.Id),
      name: String(item.Nom),
      status: String(item.Estat),
      active: toBoolean_(item.Actiu),
    })),
    teachers: teachers,
    courses: courses,
    subjects: subjects,
    plans: plans,
    assignments: assignments,
    contracts: contracts,
    rules: rules,
    chargeAssignments: chargeAssignments,
    charges: charges,
    assignmentTypes: APP_CONFIG.assignmentTypes,
  };
}

function saveAssignment(payload) {
  try {
    const user = requireWebAccess_(requireUser_(APP_CONFIG.editableRoles));
    const data = validateAssignmentPayload_(payload);
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const current = data.id ? findRowById_("Assignacions", data.id) : null;
      if (data.hours === 0) {
        if (!current) return { ok: true, deleted: false };
        const before = rowToObject_(current.headers, current.values);
        current.sheet.getRange(current.row, 10).setValue(false);
        current.sheet.getRange(current.row, 11, 1, 2).setValues([[new Date(), user.email]]);
        appendAudit_(user, "ELIMINAR", "Assignacions", data.id, before, null);
        return { ok: true, deleted: true };
      }

      const yearId = activeAcademicYearId_();
      const factor = APP_CONFIG.assignmentTypes[data.type].coverageFactor;
      const record = {
        Id: data.id || Utilities.getUuid(),
        CursEscolarId: yearId,
        GrupId: data.courseId,
        MateriaId: data.subjectId,
        ProfessorId: data.teacherId,
        Tipus: data.type,
        Hores: data.hours,
        FactorCobertura: factor,
        Observacions: data.notes,
        Activa: true,
        ActualitzatEl: new Date(),
        ActualitzatPer: user.email,
      };
      if (current) {
        const before = rowToObject_(current.headers, current.values);
        current.sheet
          .getRange(current.row, 1, 1, TABLES.Assignacions.length)
          .setValues([TABLES.Assignacions.map((header) => record[header])]);
        appendAudit_(user, "ACTUALITZAR", "Assignacions", record.Id, before, record);
      } else {
        getDatabase_()
          .getSheetByName("Assignacions")
          .appendRow(TABLES.Assignacions.map((header) => record[header]));
        appendAudit_(user, "CREAR", "Assignacions", record.Id, null, record);
      }
      return { ok: true, assignment: record };
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return publicError_(error);
  }
}

function saveCellAssignments(payload) {
  try {
    const user = requireWebAccess_(requireUser_(APP_CONFIG.editableRoles));
    const data = validateCellAssignmentsPayload_(payload);
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const yearId = activeAcademicYearId_();
      const sheet = getDatabase_().getSheetByName("Assignacions");
      const allRows = readTable_("Assignacions");
      const existing = allRows.filter(
        (item) =>
          String(item.CursEscolarId) === yearId &&
          String(item.GrupId) === data.courseId &&
          String(item.MateriaId) === data.subjectId &&
          String(item.ProfessorId) === data.teacherId &&
          toBoolean_(item.Activa)
      );
      const existingByType = existing.reduce((map, item) => {
        map[String(item.Tipus)] = item;
        return map;
      }, {});
      const requestedTypes = new Set(data.entries.map((entry) => entry.type));
      const now = new Date();

      existing.forEach((item) => {
        const type = String(item.Tipus);
        if (requestedTypes.has(type)) return;
        const record = findRowById_("Assignacions", String(item.Id));
        if (!record) return;
        record.sheet.getRange(record.row, 10).setValue(false);
        record.sheet.getRange(record.row, 11, 1, 2).setValues([[now, user.email]]);
        appendAudit_(user, "ELIMINAR", "Assignacions", String(item.Id), item, null);
      });

      const saved = data.entries.map((entry) => {
        const current = existingByType[entry.type];
        const record = {
          Id: current ? String(current.Id) : Utilities.getUuid(),
          CursEscolarId: yearId,
          GrupId: data.courseId,
          MateriaId: data.subjectId,
          ProfessorId: data.teacherId,
          Tipus: entry.type,
          Hores: entry.hours,
          FactorCobertura: APP_CONFIG.assignmentTypes[entry.type].coverageFactor,
          Observacions: "",
          Activa: true,
          ActualitzatEl: now,
          ActualitzatPer: user.email,
        };
        if (current) {
          const row = findRowById_("Assignacions", record.Id);
          row.sheet
            .getRange(row.row, 1, 1, TABLES.Assignacions.length)
            .setValues([TABLES.Assignacions.map((header) => record[header])]);
          appendAudit_(user, "ACTUALITZAR", "Assignacions", record.Id, current, record);
        } else {
          sheet.appendRow(TABLES.Assignacions.map((header) => record[header]));
          appendAudit_(user, "CREAR", "Assignacions", record.Id, null, record);
        }
        return {
          id: record.Id,
          courseId: record.GrupId,
          subjectId: record.MateriaId,
          teacherId: record.ProfessorId,
          type: record.Tipus,
          hours: record.Hores,
          coverageFactor: record.FactorCobertura,
          notes: "",
        };
      });
      return { ok: true, assignments: saved };
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return publicError_(error);
  }
}

function validateCellAssignmentsPayload_(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("La petició no és vàlida.");
  }
  const allowed = new Set(["courseId", "subjectId", "teacherId", "entries"]);
  Object.keys(payload).forEach((key) => {
    if (!allowed.has(key)) throw new Error(`Camp no permès: ${key}`);
  });
  if (!Array.isArray(payload.entries) || payload.entries.length > 4) {
    throw new Error("El contingut de la cel·la no és vàlid.");
  }
  const result = {
    courseId: validateId_(payload.courseId, "courseId"),
    subjectId: validateId_(payload.subjectId, "subjectId"),
    teacherId: validateId_(payload.teacherId, "teacherId"),
    entries: payload.entries.map((entry) => {
      const type = String(entry && entry.type ? entry.type : "").toUpperCase();
      if (!Object.prototype.hasOwnProperty.call(APP_CONFIG.assignmentTypes, type)) {
        throw new Error("Hi ha un tipus d'assignació no vàlid.");
      }
      return { type: type, hours: validateHours_(entry.hours) };
    }),
  };
  const uniqueTypes = new Set(result.entries.map((entry) => entry.type));
  if (uniqueTypes.size !== result.entries.length) {
    throw new Error("No es pot repetir el mateix tipus dins una cel·la.");
  }
  if (result.entries.some((entry) => entry.hours <= 0)) {
    throw new Error("Les hores han de ser superiors a zero.");
  }
  assertReferenceExists_("Grups", result.courseId);
  assertReferenceExists_("Materies", result.subjectId);
  assertReferenceExists_("Professorat", result.teacherId);
  const validPlan = readTable_("PlaEstudis").some(
    (item) =>
      String(item.CursEscolarId) === activeAcademicYearId_() &&
      String(item.GrupId) === result.courseId &&
      String(item.MateriaId) === result.subjectId &&
      toBoolean_(item.Actiu)
  );
  if (!validPlan) {
    throw new Error("La matèria no forma part del pla d'estudis d'aquest curs.");
  }
  return result;
}

function validateAssignmentPayload_(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("La petició no és vàlida.");
  }
  const allowed = new Set([
    "id",
    "courseId",
    "subjectId",
    "teacherId",
    "type",
    "hours",
    "notes",
  ]);
  Object.keys(payload).forEach((key) => {
    if (!allowed.has(key)) throw new Error(`Camp no permès: ${key}`);
  });
  const type = String(payload.type || "").toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(APP_CONFIG.assignmentTypes, type)) {
    throw new Error("El tipus d'assignació no és vàlid.");
  }
  const result = {
    id: payload.id ? validateId_(payload.id, "id") : "",
    courseId: validateId_(payload.courseId, "courseId"),
    subjectId: validateId_(payload.subjectId, "subjectId"),
    teacherId: validateId_(payload.teacherId, "teacherId"),
    type: type,
    hours: validateHours_(payload.hours),
    notes: safeText_(payload.notes, 300),
  };
  assertReferenceExists_("Grups", result.courseId);
  assertReferenceExists_("Materies", result.subjectId);
  assertReferenceExists_("Professorat", result.teacherId);
  const validPlan = readTable_("PlaEstudis").some(
    (item) =>
      String(item.CursEscolarId) === activeAcademicYearId_() &&
      String(item.GrupId) === result.courseId &&
      String(item.MateriaId) === result.subjectId &&
      toBoolean_(item.Actiu)
  );
  if (!validPlan) {
    throw new Error("La matèria no forma part del pla d'estudis d'aquest curs.");
  }
  return result;
}

function assertReferenceExists_(table, id) {
  if (!findRowById_(table, id)) {
    throw new Error(`La referència ${id} no existeix.`);
  }
}

function activeAcademicYearId_() {
  const configuredYearId = String(
    (readTable_("Configuracio").find((item) => String(item.Clau) === "ACTIVE_ACADEMIC_YEAR_ID") || {}).Valor || ""
  );
  const years = readTable_("CursosEscolars").filter((item) => toBoolean_(item.Actiu));
  const year =
    years.find((item) => String(item.Id) === configuredYearId) ||
    years.find((item) => String(item.Estat) === "ESBORRANY") ||
    years.find((item) => String(item.Estat) === "EN_PROCES") ||
    years[0];
  if (!year) throw new Error("No hi ha cap curs escolar editable.");
  return String(year.Id);
}

function rowToObject_(headers, values) {
  return headers.reduce((result, header, index) => {
    result[String(header)] = values[index];
    return result;
  }, {});
}
