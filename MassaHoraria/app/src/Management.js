function saveTeacher(payload) {
  return managementAction_(APP_CONFIG.adminRoles, () => {
    const user = requireUser_(APP_CONFIG.adminRoles);
    const data = validateObject_(payload, [
      "id", "firstName", "lastName1", "lastName2", "active", "contractHours", "charges",
    ]);
    const firstName = safeText_(data.firstName, 80);
    const lastName1 = safeText_(data.lastName1, 80);
    const lastName2 = safeText_(data.lastName2, 80);
    if (!firstName || !lastName1) throw new Error("Cal indicar el nom i el primer cognom.");
    const id = data.id ? validateId_(data.id, "id") : `prof-${Utilities.getUuid()}`;
    const record = {
      Id: id,
      Cognom1: lastName1,
      Cognom2: lastName2,
      Nom: firstName,
      NomComplet: [firstName, lastName1, lastName2].filter(Boolean).join(" "),
      Actiu: data.active !== false,
    };
    upsertRecord_("Professorat", id, record, user);
    upsertContract_(id, data.contractHours, user);
    replaceTeacherCharges_(id, data.charges || [], user);
    return { ok: true, id: id };
  });
}

function deleteTeacherFromYear(payload) {
  return managementAction_(APP_CONFIG.adminRoles, () => {
    const user = requireUser_(APP_CONFIG.adminRoles);
    const data = validateObject_(payload, ["teacherId"]);
    const teacherId = validateId_(data.teacherId, "teacherId");
    assertReferenceExists_("Professorat", teacherId);
    const yearId = activeAcademicYearId_();
    const now = new Date();
    let changed = 0;
    const existingContract = readTable_("Contractes").find(
      (record) => String(record.CursEscolarId) === yearId && String(record.ProfessorId) === teacherId
    );

    changed += updateMatchingRecords_("Contractes", (record) =>
      String(record.CursEscolarId) === yearId && String(record.ProfessorId) === teacherId
    , (record) => ({
      ...record,
      Hores: 0,
      Actiu: false,
    }), user, "ELIMINAR");
    if (!existingContract) {
      const deletedContractId = `con-${Utilities.getUuid()}`;
      upsertRecord_("Contractes", deletedContractId, {
        Id: deletedContractId,
        CursEscolarId: yearId,
        ProfessorId: teacherId,
        Hores: 0,
        Actiu: false,
      }, user);
      changed += 1;
    }

    changed += updateMatchingRecords_("Assignacions", (record) =>
      String(record.CursEscolarId) === yearId && String(record.ProfessorId) === teacherId && toBoolean_(record.Activa)
    , (record) => ({
      ...record,
      Activa: false,
      ActualitzatEl: now,
      ActualitzatPer: user.email,
    }), user, "ELIMINAR");

    changed += updateMatchingRecords_("AssignacionsCarrecs", (record) =>
      String(record.CursEscolarId) === yearId && String(record.ProfessorId) === teacherId && toBoolean_(record.Activa)
    , (record) => ({
      ...record,
      Hores: 0,
      Activa: false,
      ActualitzatEl: now,
      ActualitzatPer: user.email,
    }), user, "ELIMINAR");

    return { ok: true, teacherId: teacherId, changed: changed };
  });
}

function saveCourse(payload) {
  return managementAction_(APP_CONFIG.adminRoles, () => {
    const user = requireUser_(APP_CONFIG.adminRoles);
    const data = validateObject_(payload, [
      "id", "code", "name", "stage", "order", "targetHours", "active",
    ]);
    const stages = ["Infantil", "Primària", "Secundària"];
    if (!stages.includes(String(data.stage))) throw new Error("L'etapa no és vàlida.");
    const id = data.id ? validateId_(data.id, "id") : `grup-${Utilities.getUuid()}`;
    upsertRecord_("Grups", id, {
      Id: id,
      CursEscolarId: activeAcademicYearId_(),
      Codi: safeText_(data.code, 20),
      Nom: safeText_(data.name, 80),
      Etapa: data.stage,
      Ordre: validateHours_(data.order),
      HoresObjectiu: validateHours_(data.targetHours),
      Actiu: data.active !== false,
    }, user);
    return { ok: true, id: id };
  });
}

function saveSubject(payload) {
  return managementAction_(APP_CONFIG.adminRoles, () => {
    const user = requireUser_(APP_CONFIG.adminRoles);
    const data = validateObject_(payload, ["id", "name", "shortName", "active"]);
    const id = data.id ? validateId_(data.id, "id") : `mat-${Utilities.getUuid()}`;
    upsertRecord_("Materies", id, {
      Id: id,
      Nom: safeText_(data.name, 120),
      NomCurt: safeText_(data.shortName || data.name, 40),
      Activa: data.active !== false,
    }, user);
    return { ok: true, id: id };
  });
}

function savePlan(payload) {
  return managementAction_(APP_CONFIG.adminRoles, () => {
    const user = requireUser_(APP_CONFIG.adminRoles);
    const data = validateObject_(payload, [
      "id", "courseId", "subjectId", "order", "targetHours", "baseType", "active",
    ]);
    assertReferenceExists_("Grups", validateId_(data.courseId, "courseId"));
    assertReferenceExists_("Materies", validateId_(data.subjectId, "subjectId"));
    const id = data.id ? validateId_(data.id, "id") : `pla-${Utilities.getUuid()}`;
    upsertRecord_("PlaEstudis", id, {
      Id: id,
      CursEscolarId: activeAcademicYearId_(),
      GrupId: data.courseId,
      MateriaId: data.subjectId,
      Ordre: validateHours_(data.order),
      HoresObjectiu: validateHours_(data.targetHours),
      TipusBase: String(data.baseType || "CLASSE"),
      Actiu: data.active !== false,
    }, user);
    return { ok: true, id: id };
  });
}

function saveCurriculumPlan(payload) {
  return managementAction_(APP_CONFIG.adminRoles, () => {
    const user = requireUser_(APP_CONFIG.adminRoles);
    const data = validateObject_(payload, ["subject", "plan"]);
    const subject = validateObject_(data.subject, ["id", "name", "shortName", "active"]);
    const plan = validateObject_(data.plan, [
      "id", "courseId", "subjectId", "order", "targetHours", "baseType", "active",
    ]);
    const subjectId = validateId_(subject.id, "subject.id");
    if (subjectId !== validateId_(plan.subjectId, "plan.subjectId")) {
      throw new Error("La matèria i el pla no coincideixen.");
    }
    upsertRecord_("Materies", subjectId, {
      Id: subjectId,
      Nom: safeText_(subject.name, 120),
      NomCurt: safeText_(subject.shortName || subject.name, 40),
      Activa: subject.active !== false,
    }, user);
    const planId = validateId_(plan.id, "plan.id");
    assertReferenceExists_("Grups", validateId_(plan.courseId, "plan.courseId"));
    upsertRecord_("PlaEstudis", planId, {
      Id: planId,
      CursEscolarId: activeAcademicYearId_(),
      GrupId: plan.courseId,
      MateriaId: subjectId,
      Ordre: validateHours_(plan.order),
      HoresObjectiu: validateHours_(plan.targetHours),
      TipusBase: String(plan.baseType || "CLASSE"),
      Actiu: plan.active !== false,
    }, user);
    return { ok: true, subjectId: subjectId, planId: planId };
  });
}

function deleteCurriculumPlan(payload) {
  return managementAction_(APP_CONFIG.adminRoles, () => {
    const user = requireUser_(APP_CONFIG.adminRoles);
    const data = validateObject_(payload, ["planId"]);
    const planId = validateId_(data.planId, "planId");
    const current = findRowById_("PlaEstudis", planId);
    if (!current) throw new Error("No s'ha trobat la matÃ¨ria del curs.");
    const plan = rowToObject_(current.headers, current.values);
    const yearId = activeAcademicYearId_();
    if (String(plan.CursEscolarId) !== yearId) {
      throw new Error("La matÃ¨ria no pertany al curs actiu.");
    }
    const before = rowToObject_(current.headers, current.values);
    const next = {
      ...before,
      Actiu: false,
    };
    current.sheet
      .getRange(current.row, 1, 1, TABLES.PlaEstudis.length)
      .setValues([TABLES.PlaEstudis.map((header) => next[header] ?? "")]);
    appendAudit_(user, "ELIMINAR", "PlaEstudis", planId, before, null);

    const now = new Date();
    const changedAssignments = updateMatchingRecords_("Assignacions", (record) =>
      String(record.CursEscolarId) === yearId &&
      String(record.GrupId) === String(plan.GrupId) &&
      String(record.MateriaId) === String(plan.MateriaId) &&
      toBoolean_(record.Activa)
    , (record) => ({
      ...record,
      Activa: false,
      ActualitzatEl: now,
      ActualitzatPer: user.email,
    }), user, "ELIMINAR");

    return { ok: true, planId: planId, changed: 1 + changedAssignments };
  });
}

function saveCharge(payload) {
  return managementAction_(APP_CONFIG.adminRoles, () => {
    const user = requireUser_(APP_CONFIG.adminRoles);
    const data = validateObject_(payload, ["id", "name", "order", "active"]);
    const id = data.id ? validateId_(data.id, "id") : `car-${Utilities.getUuid()}`;
    upsertRecord_("Carrecs", id, {
      Id: id,
      Nom: safeText_(data.name, 100),
      Ordre: validateHours_(data.order),
      Actiu: data.active !== false,
    }, user);
    return { ok: true, id: id };
  });
}

function saveRule(payload) {
  return managementAction_(APP_CONFIG.adminRoles, () => {
    const user = requireUser_(APP_CONFIG.adminRoles);
    const data = validateObject_(payload, ["id", "stage", "hdcRate", "active"]);
    const rate = Number(data.hdcRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      throw new Error("El percentatge HDC ha d'estar entre 0 i 1.");
    }
    const id = data.id ? validateId_(data.id, "id") : `reg-${Utilities.getUuid()}`;
    upsertRecord_("ReglesComput", id, {
      Id: id,
      CursEscolarId: activeAcademicYearId_(),
      Etapa: safeText_(data.stage, 40),
      PercentatgeHdc: rate,
      Actiu: data.active !== false,
    }, user);
    return { ok: true, id: id };
  });
}

function managementAction_(roles, action) {
  try {
    requireWebAccess_(requireUser_(roles));
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      return action();
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return publicError_(error);
  }
}

function validateObject_(payload, allowedKeys) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("La petició no és vàlida.");
  }
  const allowed = new Set(allowedKeys);
  Object.keys(payload).forEach((key) => {
    if (!allowed.has(key)) throw new Error(`Camp no permès: ${key}`);
  });
  return payload;
}

function upsertRecord_(tableName, id, record, user) {
  const current = findRowById_(tableName, id);
  if (current) {
    const before = rowToObject_(current.headers, current.values);
    current.sheet
      .getRange(current.row, 1, 1, TABLES[tableName].length)
      .setValues([TABLES[tableName].map((header) => record[header] ?? "")]);
    appendAudit_(user, "ACTUALITZAR", tableName, id, before, record);
  } else {
    getDatabase_()
      .getSheetByName(tableName)
      .appendRow(TABLES[tableName].map((header) => record[header] ?? ""));
    appendAudit_(user, "CREAR", tableName, id, null, record);
  }
}

function updateMatchingRecords_(tableName, predicate, updateRecord, user, action) {
  const spreadsheet = getDatabase_();
  const sheet = spreadsheet.getSheetByName(tableName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  const headers = values[0].map(String);
  let count = 0;
  for (let index = 1; index < values.length; index += 1) {
    const before = rowToObject_(headers, values[index]);
    if (!predicate(before)) continue;
    const next = updateRecord(before);
    sheet
      .getRange(index + 1, 1, 1, TABLES[tableName].length)
      .setValues([TABLES[tableName].map((header) => next[header] ?? "")]);
    appendAudit_(user, action || "ACTUALITZAR", tableName, String(before.Id || ""), before, next);
    count += 1;
  }
  return count;
}

function upsertContract_(teacherId, hoursValue, user) {
  const yearId = activeAcademicYearId_();
  const hours = validateHours_(hoursValue || 0);
  const existing = readTable_("Contractes").find(
    (item) => String(item.CursEscolarId) === yearId && String(item.ProfessorId) === teacherId
  );
  const id = existing ? String(existing.Id) : `con-${Utilities.getUuid()}`;
  upsertRecord_("Contractes", id, {
    Id: id,
    CursEscolarId: yearId,
    ProfessorId: teacherId,
    Hores: hours,
    Actiu: hours > 0,
  }, user);
}

function replaceTeacherCharges_(teacherId, charges, user) {
  if (!Array.isArray(charges)) throw new Error("Els càrrecs no són vàlids.");
  const yearId = activeAcademicYearId_();
  const existing = readTable_("AssignacionsCarrecs").filter(
    (item) => String(item.CursEscolarId) === yearId && String(item.ProfessorId) === teacherId
  );
  const requested = new Map();
  charges.forEach((item) => {
    const chargeId = validateId_(item.chargeId, "chargeId");
    assertReferenceExists_("Carrecs", chargeId);
    const hours = validateHours_(item.hours);
    if (hours > 0) requested.set(chargeId, hours);
  });
  existing.forEach((item) => {
    const chargeId = String(item.CarrecId);
    const id = String(item.Id);
    upsertRecord_("AssignacionsCarrecs", id, {
      Id: id,
      CursEscolarId: yearId,
      ProfessorId: teacherId,
      CarrecId: chargeId,
      Hores: requested.get(chargeId) || 0,
      Observacions: item.Observacions || "",
      Activa: requested.has(chargeId),
      ActualitzatEl: new Date(),
      ActualitzatPer: user.email,
    }, user);
    requested.delete(chargeId);
  });
  requested.forEach((hours, chargeId) => {
    const id = `ac-${Utilities.getUuid()}`;
    upsertRecord_("AssignacionsCarrecs", id, {
      Id: id,
      CursEscolarId: yearId,
      ProfessorId: teacherId,
      CarrecId: chargeId,
      Hores: hours,
      Observacions: "",
      Activa: true,
      ActualitzatEl: new Date(),
      ActualitzatPer: user.email,
    }, user);
  });
}
