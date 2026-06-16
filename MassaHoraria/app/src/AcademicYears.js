function cloneAcademicYear_(sourceName, targetName) {
  const user = requireUser_(APP_CONFIG.adminRoles);
  const sourceLabel = safeText_(sourceName, 20);
  const targetLabel = safeText_(targetName, 20);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const years = readTable_("CursosEscolars");
    const source = years.find((item) => String(item.Nom) === sourceLabel);
    if (!source) throw new Error(`No existeix el curs ${sourceLabel}.`);
    const existingTarget = years.find((item) => String(item.Nom) === targetLabel);
    if (existingTarget) {
      return {
        ok: true,
        created: false,
        message: `El curs ${targetLabel} ja estava preparat. No s'ha duplicat cap dada.`,
        verification: verifyDatabase_(),
      };
    }

    const sourceYearId = String(source.Id);
    const targetYearId = `curs-${targetLabel}`;
    const now = new Date();
    const slugSuffix = targetLabel.replace(/[^0-9a-z]+/gi, "-").toLowerCase();

    const sourceGroups = readTable_("Grups").filter(
      (item) => String(item.CursEscolarId) === sourceYearId
    );
    const groupMap = {};
    const targetGroups = sourceGroups.map((item) => {
      const oldId = String(item.Id);
      const newId = `${oldId}-${slugSuffix}`;
      groupMap[oldId] = newId;
      return {
        Id: newId,
        CursEscolarId: targetYearId,
        Codi: item.Codi,
        Nom: item.Nom,
        Etapa: item.Etapa,
        Ordre: item.Ordre,
        HoresObjectiu: item.HoresObjectiu,
        Actiu: item.Actiu,
      };
    });

    const sourcePlans = readTable_("PlaEstudis").filter(
      (item) => String(item.CursEscolarId) === sourceYearId
    );
    const targetPlans = sourcePlans.map((item) => ({
      Id: `${String(item.Id)}-${slugSuffix}`,
      CursEscolarId: targetYearId,
      GrupId: groupMap[String(item.GrupId)],
      MateriaId: item.MateriaId,
      Ordre: item.Ordre,
      HoresObjectiu: item.HoresObjectiu,
      TipusBase: item.TipusBase,
      Actiu: item.Actiu,
    }));

    const targetContracts = readTable_("Contractes")
      .filter((item) => String(item.CursEscolarId) === sourceYearId)
      .map((item) => ({
        Id: `${String(item.Id)}-${slugSuffix}`,
        CursEscolarId: targetYearId,
        ProfessorId: item.ProfessorId,
        Hores: item.Hores,
        Actiu: item.Actiu,
      }));

    const targetRules = readTable_("ReglesComput")
      .filter((item) => String(item.CursEscolarId) === sourceYearId)
      .map((item) => ({
        Id: `${String(item.Id)}-${slugSuffix}`,
        CursEscolarId: targetYearId,
        Etapa: item.Etapa,
        PercentatgeHdc: item.PercentatgeHdc,
        Actiu: item.Actiu,
      }));

    const targetAssignments = readTable_("Assignacions")
      .filter((item) => String(item.CursEscolarId) === sourceYearId)
      .map((item, index) => ({
        Id: `ass-${slugSuffix}-${String(index + 1).padStart(4, "0")}`,
        CursEscolarId: targetYearId,
        GrupId: groupMap[String(item.GrupId)],
        MateriaId: item.MateriaId,
        ProfessorId: item.ProfessorId,
        Tipus: item.Tipus,
        Hores: item.Hores,
        FactorCobertura: item.FactorCobertura,
        Observacions: item.Observacions,
        Activa: item.Activa,
        ActualitzatEl: now,
        ActualitzatPer: user.email,
      }));

    const targetChargeAssignments = readTable_("AssignacionsCarrecs")
      .filter((item) => String(item.CursEscolarId) === sourceYearId)
      .map((item, index) => ({
        Id: `ac-${slugSuffix}-${String(index + 1).padStart(3, "0")}`,
        CursEscolarId: targetYearId,
        ProfessorId: item.ProfessorId,
        CarrecId: item.CarrecId,
        Hores: item.Hores,
        Observacions: item.Observacions,
        Activa: item.Activa,
        ActualitzatEl: now,
        ActualitzatPer: user.email,
      }));

    appendObjects_("CursosEscolars", [
      { Id: targetYearId, Nom: targetLabel, Estat: "ESBORRANY", Actiu: true, CreatEl: now },
    ]);
    appendObjects_("Grups", targetGroups);
    appendObjects_("PlaEstudis", targetPlans);
    appendObjects_("Contractes", targetContracts);
    appendObjects_("ReglesComput", targetRules);
    appendObjects_("Assignacions", targetAssignments);
    appendObjects_("AssignacionsCarrecs", targetChargeAssignments);
    updateRecordById_("CursosEscolars", sourceYearId, { Estat: "TANCAT", Actiu: true });
    updateConfiguration_("ACTIVE_ACADEMIC_YEAR_ID", targetYearId);
    removeDefaultSheet_(getDatabase_());

    const summary = {
      groups: targetGroups.length,
      plans: targetPlans.length,
      contracts: targetContracts.length,
      assignments: targetAssignments.length,
      chargeAssignments: targetChargeAssignments.length,
      rules: targetRules.length,
    };
    appendAudit_(
      user,
      "DUPLICAR_CURS",
      "CursosEscolars",
      targetYearId,
      { sourceYearId: sourceYearId },
      summary
    );
    return {
      ok: true,
      created: true,
      message:
        `El curs ${sourceLabel} ha quedat tancat i s'ha creat ${targetLabel} com a esborrany. ` +
        `S'han copiat ${summary.groups} cursos, ${summary.plans} matèries de curs, ` +
        `${summary.assignments} assignacions, ${summary.contracts} contractes i ` +
        `${summary.chargeAssignments} assignacions de càrrecs.`,
      summary: summary,
      verification: verifyDatabase_(),
    };
  } finally {
    lock.releaseLock();
  }
}

function saveAcademicYearStatus(payload) {
  try {
    const user = requireWebAccess_(requireUser_(APP_CONFIG.adminRoles));
    const data = validateObject_(payload, ["id", "status"]);
    const id = validateId_(data.id, "id");
    const status = String(data.status || "").toUpperCase();
    const allowedStatuses = ["ESBORRANY", "EN_PROCES", "ACTIU", "TANCAT"];
    if (!allowedStatuses.includes(status)) {
      throw new Error("L'estat del curs no és vàlid.");
    }
    const before = findRowById_("CursosEscolars", id);
    if (!before) throw new Error("No s'ha trobat el curs escolar.");
    const updated = updateRecordById_("CursosEscolars", id, { Estat: status, Actiu: true });
    updateConfiguration_("ACTIVE_ACADEMIC_YEAR_ID", id);
    appendAudit_(user, "ACTUALITZAR_ESTAT_CURS", "CursosEscolars", id, rowToObject_(before.headers, before.values), updated);
    return { ok: true, id: id, status: status };
  } catch (error) {
    return publicError_(error);
  }
}

function createNextAcademicYear(payload) {
  try {
    const user = requireWebAccess_(requireUser_(APP_CONFIG.adminRoles));
    const data = validateObject_(payload || {}, ["sourceName", "targetName"]);
    const sourceName = safeText_(data.sourceName || activeAcademicYearName_(), 20);
    const targetName = safeText_(data.targetName || nextAcademicYearName_(sourceName), 20);
    appendAudit_(user, "SOL_LICITAR_NOU_CURS", "CursosEscolars", targetName, { sourceName: sourceName }, null);
    return cloneAcademicYear_(sourceName, targetName);
  } catch (error) {
    return publicError_(error);
  }
}

function activeAcademicYearName_() {
  const config = readTable_("Configuracio").find((item) => String(item.Clau) === "ACTIVE_ACADEMIC_YEAR_ID");
  const years = readTable_("CursosEscolars");
  const year = years.find((item) => String(item.Id) === String(config && config.Valor || "")) ||
    years.find((item) => String(item.Estat) === "ESBORRANY") ||
    years[0];
  if (!year) throw new Error("No hi ha cap curs escolar disponible.");
  return String(year.Nom);
}

function nextAcademicYearName_(name) {
  const match = String(name || "").match(/^(\d{4}|\d{2})-(\d{2}|\d{4})$/);
  if (!match) throw new Error("No s'ha pogut calcular el curs següent.");
  const first = Number(match[1]);
  const firstFull = first < 100 ? 2000 + first : first;
  const nextFirst = firstFull + 1;
  const nextSecond = String((nextFirst + 1) % 100).padStart(2, "0");
  return `${nextFirst}-${nextSecond}`;
}

function updateConfiguration_(key, value) {
  const sheet = getDatabase_().getSheetByName("Configuracio");
  const values = sheet.getDataRange().getValues();
  for (let index = 1; index < values.length; index += 1) {
    if (String(values[index][0]) === key) {
      sheet.getRange(index + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function verifyDatabase_() {
  const tables = {};
  Object.keys(TABLES).forEach((name) => {
    tables[name] = readTable_(name).length;
  });
  const years = readTable_("CursosEscolars").map((year) => {
    const id = String(year.Id);
    return {
      id: id,
      name: String(year.Nom),
      status: String(year.Estat),
      groups: readTable_("Grups").filter((item) => String(item.CursEscolarId) === id).length,
      plans: readTable_("PlaEstudis").filter((item) => String(item.CursEscolarId) === id).length,
      contracts: readTable_("Contractes").filter(
        (item) => String(item.CursEscolarId) === id
      ).length,
      assignments: readTable_("Assignacions").filter(
        (item) => String(item.CursEscolarId) === id
      ).length,
      chargeAssignments: readTable_("AssignacionsCarrecs").filter(
        (item) => String(item.CursEscolarId) === id
      ).length,
      rules: readTable_("ReglesComput").filter(
        (item) => String(item.CursEscolarId) === id
      ).length,
    };
  });
  return {
    ok: true,
    spreadsheetName: getDatabase_().getName(),
    tables: tables,
    years: years,
  };
}
