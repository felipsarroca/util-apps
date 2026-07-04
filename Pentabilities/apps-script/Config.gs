const APP = {
  name: 'Pentabilities',
  version: '0.1.0',
  timeZone: 'Europe/Madrid',
  schoolDomain: 'ramonpont.cat',
  databaseName: 'Pentabilities - Base de dades',
  spreadsheetIdProperty: 'PENTABILITIES_SPREADSHEET_ID',
  teacherPasswordProperty: 'PENTABILITIES_TEACHER_PASSWORD',
  supabaseUrlProperty: 'PENTABILITIES_SUPABASE_URL',
  supabaseAnonKeyProperty: 'PENTABILITIES_SUPABASE_ANON_KEY',
  supabaseRosterSecretProperty: 'PENTABILITIES_SUPABASE_ROSTER_SECRET',
  seedVersionProperty: 'PENTABILITIES_SEED_VERSION',
  seedVersion: '2026-07-02-rosters-v1',
  defaultSchoolYear: '2026-2027',
  adminFallbackEmails: [
    'felip.sarroca@ramonpont.cat',
    'felip.sarroca@gmail.com'
  ]
};

const SHEETS = {
  schoolYears: 'Cursos_Escolars',
  students: 'Alumnes',
  teachers: 'Professorat_App',
  skills: 'Habilitats',
  behaviors: 'Comportaments',
  cycles: 'Cicles',
  sessions: 'Sessions',
  sessionBehaviors: 'Sessio_Comportaments',
  sessionHeteroStudents: 'Sessio_Heteroalumnes',
  evaluations: 'Avaluacions'
};

const ROSTER_SHEETS = [
  { sheetName: '1r dESO', classe: '1r dESO', prefix: '1ESO' },
  { sheetName: '2n dESO', classe: '2n dESO', prefix: '2ESO' },
  { sheetName: '3r dESO', classe: '3r dESO', prefix: '3ESO' },
  { sheetName: '4t dESO', classe: '4t dESO', prefix: '4ESO' }
];

const ROSTER_TEACHERS_SHEET = 'Professorat';
const ROSTER_HEADERS = ['Nom', 'Cognom', 'Correu electrònic'];

const HEADERS = {
  [SHEETS.schoolYears]: ['curs_id', 'nom_curs', 'data_inici', 'data_final', 'estat', 'created_at', 'updated_at'],
  [SHEETS.students]: ['alumne_id', 'nom', 'cognoms', 'nom_complet', 'email', 'classe', 'actiu'],
  [SHEETS.teachers]: ['professor_id', 'nom', 'cognoms', 'nom_complet', 'email', 'rol', 'actiu'],
  [SHEETS.skills]: ['habilitat_id', 'codi_habilitat', 'nom_habilitat', 'descripcio', 'color', 'ordre'],
  [SHEETS.behaviors]: ['comportament_id', 'codi_comportament', 'habilitat_id', 'nom_comportament', 'descripcio', 'ordre', 'actiu'],
  [SHEETS.cycles]: ['cicle_id', 'nom_cicle', 'classe', 'professor_id', 'data_inici', 'data_final', 'estat', 'descripcio', 'created_at', 'updated_at'],
  [SHEETS.sessions]: ['sessio_id', 'cicle_id', 'nom_sessio', 'classe', 'data_sessio', 'codi_acces', 'estat', 'professor_id', 'created_at', 'updated_at'],
  [SHEETS.sessionBehaviors]: ['sessio_id', 'codi_comportament'],
  [SHEETS.sessionHeteroStudents]: ['sessio_id', 'alumne_id'],
  [SHEETS.evaluations]: ['avaluacio_id', 'timestamp', 'cicle_id', 'sessio_id', 'classe', 'avaluador_id', 'avaluador_tipus', 'avaluador_email', 'avaluat_id', 'codi_comportament', 'valor', 'tipus_avaluacio']
};

const SESSION_STATUS = {
  draft: 'esborrany',
  open: 'oberta',
  closed: 'tancada'
};

const CYCLE_STATUS = {
  active: 'actiu',
  closed: 'finalitzat',
  archived: 'arxivat'
};
