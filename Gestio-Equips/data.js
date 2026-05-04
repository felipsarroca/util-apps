export const ESTATS = {
  lliure: "Lliure",
  assignat: "Assignat",
  incidencia_menor: "Incidència menor",
  pendent_reparacio_interna: "Pendent de reparació menor",
  pendent_servei_tecnic_extern: "Pendent de reparació major",
  fora_servei: "Fora de servei",
};

export const EVENT_TYPE_LABELS = {
  assignacio: "Assignació",
  retorn: "Retorn",
  canvi_propietari: "Canvi de propietari",
  incidencia: "Incidència",
  reparacio_interna: "Reparació menor",
  servei_tecnic_extern: "Reparació major",
  reparat: "Reparat",
  observacio: "Observació",
};

const makeIcon = (path) => `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    ${path}
  </svg>
`;

export const ACTION_ICONS = {
  assignacio: makeIcon('<rect x="4.5" y="5.5" width="15" height="10.5" rx="2.8"/><path d="M8.8 19h6.4"/><path d="m9.1 11.3 2 2 4-4"/>'),
  canvi_propietari: makeIcon('<circle cx="8" cy="9" r="2.2"/><path d="M4.8 17c.7-1.9 2.1-2.9 4.2-2.9"/><circle cx="16.5" cy="15" r="2.1"/><path d="M13.5 20c.5-1.6 1.7-2.6 3.6-2.9"/><path d="M10 12h6.3"/><path d="m13.7 9.3 2.8 2.7-2.8 2.7"/>'),
  retorn: makeIcon('<rect x="8" y="5.5" width="11.2" height="10" rx="2.6"/><path d="M10.2 18.8h6.6"/><path d="m8.4 12.2-3.4-3.2 3.4-3.2"/><path d="M5.4 9h8"/>'),
  incidencia: makeIcon('<path d="M12 4.5 4.8 17.7h14.4L12 4.5Z"/><path d="M12 8.7v4.2"/><circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none"/>'),
  reparacio_interna: makeIcon('<path d="m14.9 6.5 2.6 2.6"/><path d="m13.8 7.6-6.3 6.3-1.1 3 3-1.1 6.3-6.3"/><path d="M12.5 8.9 15 11.4"/>'),
  servei_tecnic_extern: makeIcon('<path d="m7.2 7.2 9.6 9.6"/><path d="m15.4 5.5 3.1 3.1"/><path d="m5.5 15.4 3.1 3.1"/><path d="m10.3 13.7 3.4-3.4"/>'),
  baixa: makeIcon('<circle cx="12" cy="12" r="7.2"/><path d="M8.3 8.3 15.7 15.7"/><path d="M15.7 8.3 8.3 15.7"/>'),
  reparat: makeIcon('<path d="M12 4.8 18 7.2v4.7c0 3-2 5.6-6 7.3-4-1.7-6-4.3-6-7.3V7.2L12 4.8Z"/><path d="m9.1 12.3 2.1 2.1 4.2-4.4"/>'),
  observacio: makeIcon('<path d="M8.2 4.8h5.7l3.1 3.1V19a1.8 1.8 0 0 1-1.8 1.8H8.8A1.8 1.8 0 0 1 7 19V6.6a1.8 1.8 0 0 1 1.2-1.8Z"/><path d="M13.9 4.8v3.3h3.1"/><path d="M9.6 11.1h4.9"/><path d="M9.6 14.2h4.9"/><path d="M9.6 17.3h3.1"/>'),
};

export const QUICK_ACTIONS = [
  {
    id: "assignacio",
    label: "Assignar",
    helper: "Assigna l'equip a un usuari",
    icon: ACTION_ICONS.assignacio,
    tone: "positive",
    eventType: "assignacio",
    nextState: "assignat",
    requiresUser: true,
  },
  {
    id: "canvi_propietari",
    label: "Canvi de propietari",
    helper: "Tanca l'assignació actual i n'obre una de nova",
    icon: ACTION_ICONS.canvi_propietari,
    tone: "neutral",
    eventType: "canvi_propietari",
    nextState: "assignat",
    requiresUser: true,
  },
  {
    id: "retorn",
    label: "Deixar lliure",
    helper: "Tanca l'assignació actual",
    icon: ACTION_ICONS.retorn,
    tone: "neutral",
    eventType: "retorn",
    nextState: "lliure",
    clearsUser: true,
  },
  {
    id: "incidencia",
    label: "Incidència",
    helper: "Registra una incidència general",
    icon: ACTION_ICONS.incidencia,
    tone: "warning",
    eventType: "incidencia",
    nextState: "incidencia_menor",
  },
  {
    id: "reparacio_interna",
    label: "Reparació menor",
    helper: "Incidència resoluble internament",
    icon: ACTION_ICONS.reparacio_interna,
    tone: "warning",
    eventType: "reparacio_interna",
    nextState: "pendent_reparacio_interna",
  },
  {
    id: "servei_tecnic_extern",
    label: "Reparació major",
    helper: "Enviar a servei tècnic extern",
    icon: ACTION_ICONS.servei_tecnic_extern,
    tone: "danger",
    eventType: "servei_tecnic_extern",
    nextState: "pendent_servei_tecnic_extern",
  },
  {
    id: "baixa",
    label: "Baixa",
    helper: "Marca l'equip com a fora de servei",
    icon: ACTION_ICONS.baixa,
    tone: "danger",
    eventType: "observacio",
    nextState: "fora_servei",
    clearsUser: true,
    closesAssignment: true,
    defaultDescription: "Baixa definitiva de l'equip",
  },
  {
    id: "reparat",
    label: "Marcar com reparat",
    helper: "Torna l'equip a estat disponible",
    icon: ACTION_ICONS.reparat,
    tone: "positive",
    eventType: "reparat",
    nextState: "lliure",
    clearsUser: true,
    closesAssignment: true,
  },
  {
    id: "observacio",
    label: "Observació",
    helper: "Afegeix una nota amb data",
    icon: ACTION_ICONS.observacio,
    tone: "neutral",
    eventType: "observacio",
  },
];

export const initialUsuaris = [
  { id: "usr-1", nom: "Amina", cognoms: "El Idrissi", tipusUsuari: "alumne", actiu: true },
  { id: "usr-2", nom: "Youssef", cognoms: "Bakkali", tipusUsuari: "alumne", actiu: true },
  { id: "usr-3", nom: "PFI", cognoms: "", tipusUsuari: "generic", actiu: true },
];

export const initialOrdinadors = [
  { id: "rppo-14", codi: "RPPO 14", estat: "assignat", usuariActualId: "usr-1", observacions: "Carregador revisat el març." },
  { id: "rppo-21", codi: "RPPO 21", estat: "lliure", usuariActualId: null, observacions: "" },
  { id: "rppo-32", codi: "RPPO 32", estat: "pendent_servei_tecnic_extern", usuariActualId: null, observacions: "Pantalla amb ratlles verticals." },
];

export const initialEsdeveniments = [
  { id: "evt-1", ordinadorId: "rppo-14", usuariId: "usr-1", tipus: "assignacio", data: "2026-03-12", descripcio: "Assignat a l'alumna a inici de trimestre." },
  { id: "evt-2", ordinadorId: "rppo-14", usuariId: "usr-1", tipus: "observacio", data: "2026-03-25", descripcio: "Bateria correcta. Es recomana portar funda." },
  { id: "evt-3", ordinadorId: "rppo-32", usuariId: "usr-2", tipus: "incidencia", data: "2026-04-01", descripcio: "La pantalla falla de manera intermitent." },
  { id: "evt-4", ordinadorId: "rppo-32", usuariId: null, tipus: "servei_tecnic_extern", data: "2026-04-03", descripcio: "Enviat al servei tècnic extern." },
];
