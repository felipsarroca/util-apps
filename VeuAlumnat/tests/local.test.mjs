import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../apps-script');
const context = vm.createContext({});
for (const name of ['Core.gs', 'Data.gs', 'Forms.gs', 'Mail.gs', 'Pdf.gs', 'Reports.gs']) {
  vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, {filename: name});
}
const run = code => vm.runInContext(code, context);
assert.equal(run("nameKey_('Aarass Aarass, Anuar')"), run("nameKey_('Anuar Aàrass Aarass')"));
assert.equal(run("mailKey_(' FAMILIA@EXEMPLE.CAT ')"), 'familia@exemple.cat');
assert.equal(run("editDistance_('Pérez, Núria', 'Nuria Perez')"), 0);
assert.equal(run("isQuestion_({getType: () => 'RATING'})"), true);
assert.equal(run("safeRows_([['=IMPORTXML(1)', 'correcte']])[0][0]"), "'=IMPORTXML(1)");
const campaign = ['id', '4t.ESO', '2026-2027', 'Preavaluació'];
context.campaign = campaign;
assert.match(run("mailContent_('Exemple Exemple, Júlia', campaign, true)"), /^Benvolguda família,\n\nJúlia ha dedicat/);
assert.doesNotMatch(run("mailContent_('Exemple, Júlia', campaign, true)"), /respondre aquest missatge/);
assert.equal(run("mailSubject_('Exemple Exemple, Júlia', campaign)"), 'L’autoavaluació de Júlia Exemple Exemple · Preavaluació');
assert.match(run("mailHtml_('Exemple, <b>Júlia</b>', campaign, false)"), /&lt;b&gt;Júlia&lt;\/b&gt; ha dedicat/);
assert.match(run("mailContent_('Júlia Exemple', campaign, true)"), /enllaç per confirmar/);
assert.doesNotMatch(run("mailContent_('Júlia Exemple', campaign, false)"), /enllaç per confirmar/);
const state = {
  students: [['100', '4t.ESO', 'Exemple, Júlia', 'julia@ramonpont.cat', 'SI']],
  contacts: [], contactAliases: [], issues: []
};
context.Utilities = {parseCsv: s => s.trim().split(/\r?\n/).map(line => line.split(';'))};
context.Utilities.formatDate = d => d.toISOString().slice(0, 19);
context.requireAccess_ = () => true;
context.rows_ = name => state[name] || [];
context.replaceRows_ = (name, rows) => {state[name] = rows};
context.setConfig_ = () => {};
const savedCsv = [];
context.DriveApp = {createFolder: () => ({getId: () => 'arrel',
  createFile: (name, text) => { savedCsv.push(text); return {getId: () => 'csv'}; }})};
const csv = 'Núm.;Curs;Curs escolar;Nom alumne;Nom i cognoms;Correu electrònic\n'
  + '1;Quart d\'ESO;2026-2027;Júlia Exemple;Mare Exemple;familia@example.net\n'
  + '2;Quart d\'ESO;2026-2027;Júlia Exemple;Pare Exemple;familia@example.net\n'
  + '3;Quart d\'ESO;2026-2027;Altra Persona;Mare Altra;altra@example.net';
context.csv = csv;
const imported = run('importContactsCsv(csv)');
assert.equal(imported.uniqueRecipients, 1);
assert.equal(imported.unmatched.length, 1);
assert.equal(state.contacts[0][2], 'Mare Exemple i Pare Exemple');
// Altres anys: el curs escrit de moltes maneres i un CSV amb una altra capçalera i un altre separador.
for (const [text, course] of [["Quart d'ESO", '4t.ESO'], ['4t ESO', '4t.ESO'], ['4t.ESO', '4t.ESO'], ['1ESO', '1r.ESO'],
  ['2n ESO B', '2n.ESO'], ['Tercer curs ESO', '3r.ESO'], ['3r', ''], ['Primer de Batxillerat', '']]) {
  assert.equal(run(`courseOf_(${JSON.stringify(text)})`), course, text);
}
context.Utilities.parseCsv = (s, sep) => s.trim().split(/\r?\n/).map(line => line.split(sep));
context.csv2 = 'Correu electrònic,Alumne/a,Responsable\nfamilia@example.net,Júlia Exemple,Mare Exemple';
assert.throws(() => run('contactsTable_(csv2)'), /columnes de curs/);
context.csv2 = 'Correu electrònic,Nom de l’alumne,Curs,Responsable\nfamilia@example.net,Júlia Exemple,4t ESO,Mare Exemple';
assert.deepEqual({...run('contactsTable_(csv2).cols')}, {course: 2, student: 1, guardian: 3, email: 0});
state.contacts = [];
assert.equal(run('importContactsCsv(csv2)').uniqueRecipients, 1);
assert.equal(state.contacts[0][3], 'familia@example.net');
const roster = {
  '1r.ESO': [['', '', '', '', 'Exemple, Aina', '101', '', 'aina@ramonpont.cat'],
    ['', '', '', '', 'Fitxa pendent', '', '', '']],
  '2n.ESO': [['', '', '', '', 'Exemple, Biel', '102', '', 'biel@ramonpont.cat']],
  '3r.ESO': [], '4t.ESO': []
};
context.idFromUrl_ = () => 'cens';
context.SpreadsheetApp = {openById: () => ({getId: () => 'cens', getSheetByName: course => ({
  getLastRow: () => roster[course].length + 2,
  getRange: () => ({getDisplayValues: () => roster[course]})
})})};
const census = run("importStudents('cens')");
assert.equal(census.students, 2);
assert.equal(census.pending, 1);
assert.equal(state.issues.filter(r => r[1] === 'cens_pendent').length, 1);
roster['3r.ESO'] = [['', '', '', '', 'Exemple, Carla', '103', '', '']];
assert.throws(() => run("importStudents('cens')"), /1 incidències/);
assert.equal(state.students.length, 2);
state.campaigns = [['batch', '4t.ESO', '2026-2027', 'Preavaluació', 'formulari', 'TANCADA', '', '']];
state.students = [['101', '4t.ESO', 'Exemple, Aina', 'aina@ramonpont.cat', 'SI'],
  ['102', '4t.ESO', 'Exemple, Biel', 'biel@ramonpont.cat', 'SI']];
state.legacy = [['batch', 'r1', 'Aina E.', '101', 'PENDENT'],
  ['batch', 'r2', 'Biel E.', '102', 'PENDENT']];
context.collectCampaign_ = () => ({});
assert.equal(run("approveSuggestedLegacyBatch('batch').approved"), 2);
assert.equal(state.legacy.filter(r => r[4] === 'SI').length, 2);
state.legacy = [['batch', 'r1', 'Aina E.', '101', 'PENDENT'],
  ['batch', 'r2', 'Altra E.', '101', 'PENDENT']];
const duplicated = run("approveSuggestedLegacyBatch('batch')");
assert.equal(duplicated.approved, 0);
assert.equal(duplicated.remaining, 2);
assert.equal(state.legacy.filter(r => r[4] === 'SI').length, 0);
state.legacy = [['batch', 'r1', 'Aina E.', '101', 'PENDENT'],
  ['batch', 'r2', 'Nom no trobat', '', 'PENDENT']];
const partial = run("approveSuggestedLegacyBatch('batch')");
assert.equal(partial.approved, 1);
assert.equal(partial.remaining, 1);
assert.equal(partial.unresolved[0], 'Nom no trobat');
assert.equal(state.legacy.filter(r => r[4] === 'SI').length, 1);
// Estructura genèrica: seccions, blocs de valoració, preguntes «[tutor]» i identificació.
const item = (id, type, title, api = {}, help = '') => ({getId: () => id, getType: () => type,
  getTitle: () => title, getHelpText: () => help, ...api});
const choices = values => values.map(v => ({getValue: () => v}));
const rating = {asRatingItem: () => ({getRatingScaleLevel: () => 4})};
const formItems = [
  item(1, 'TEXT', 'Nom i inicial del cognom'),
  item(2, 'RATING', 'Català', rating),
  item(3, 'PARAGRAPH_TEXT', 'Catala'),
  item(4, 'RATING', 'Matemàtiques', rating),
  item(5, 'PARAGRAPH_TEXT', 'Matemàtiques'),
  item(6, 'PAGE_BREAK', 'Com em sento a l’escola'),
  item(7, 'SCALE', 'Em sento bé al grup', {asScaleItem: () => ({getLowerBound: () => 1, getUpperBound: () => 5})}),
  item(8, 'PARAGRAPH_TEXT', 'Per què?'),
  item(9, 'CHECKBOXES', 'Què m’ajuda a estudiar', {asCheckboxItem: () => ({getChoices: () => choices(['Esquemes', 'Exercicis', 'Vídeos'])})}),
  item(10, 'PARAGRAPH_TEXT', 'Observacions [tutor]'),
  item(11, 'SECTION_HEADER', 'Notes internes [tutor]'),
  item(12, 'PARAGRAPH_TEXT', 'Res d’això surt'),
  item(13, 'PAGE_BREAK', 'Hàbits'),
  item(14, 'GRID', 'Amb quina freqüència…', {asGridItem: () => ({getRows: () => ['Llegeixo', 'Faig deures']})}),
  item(15, 'MULTIPLE_CHOICE', 'Previsió de Música', {asMultipleChoiceItem: () => ({getChoices: () => choices(['1 NA', '2 AS', '3 AN', '4 AE'])})}),
  item(16, 'IMAGE', 'Il·lustració')
];
context.testForm = {getItems: () => formItems};
context.structure = run('formStructure_(testForm)');
const structure = context.structure;
assert.equal(structure.identityId, '1');
assert.deepEqual([...structure.sections.map(s => s.title)], ['', 'Com em sento a l’escola', 'Hàbits']);
assert.equal(structure.sections[0].blocks.length, 2);
assert.equal(structure.sections[0].blocks[0].level.scale.max, 4);
assert.equal(structure.sections[1].blocks[0].questions.length, 2);
assert.equal(structure.sections[2].blocks.length, 2);
assert.equal(structure.sections[2].blocks[1].level.scale.max, 4);
assert.equal(run('structureSummary_(structure).levels'), 4);
assert.equal(run("levelOf_('3 - AN')"), '3');
assert.equal(run("levelOf_('AE')"), '4');
assert.equal(run("levelOf_('No assolit')"), '1');
assert.equal(run("levelOf_('10')"), '');
// Model de l'informe: el que és buit s'omet; etiqueta per defecte quan el títol repeteix la matèria.
context.answers = new Map([['1', 'Aina E.'], ['2', '3'], ['3', 'Llegiré cada dia.'], ['4', ''], ['5', ''],
  ['7', '4'], ['8', ''], ['9', ['Esquemes', 'Vídeos']], ['10', 'privat'], ['14', ['Sovint', null]], ['15', '2 AS']]);
context.model = run('reportModel_(structure, answers)');
const model = context.model;
assert.equal(model.length, 3);
assert.equal(model[0].blocks.length, 1);
assert.equal(model[0].blocks[0].level.abbr, 'AN');
assert.equal(model[0].blocks[0].items[0].label, 'Compromís de millora');
assert.equal(model[1].blocks[0].level.text, '4 de 5');
assert.equal(model[1].blocks[0].items.length, 1);
assert.equal(model[1].blocks[0].items[0].value.list.length, 2);
assert.equal(model[2].blocks[0].items[0].value.table.length, 1);
assert.equal(model[2].blocks[1].level.code, '2');
// PDF propi: estructura vàlida, caràcters catalans i cap targeta partida entre pàgines.
assert.deepEqual([...run("winAnsi_('l·l ’à€😀ŀ')")], [108, 183, 108, 32, 146, 224, 128, 108, 183]);
assert.ok(run("pdfWrap_('paraula '.repeat(300), 'F1', 10, 120).length") > 20);
context.meta = {student: 'Júlia Exemple', label: 'Preavaluació', course: '4t.ESO', year: '2026-2027', logo: '',
  legend: true, confirmUrl: 'https://script.google.com/x?token=a', generated: '27/10/2026', title: 'Prova'};
const pdf = Buffer.from([...run('buildReportPdf_(model, meta)')].map(b => b & 255)).toString('latin1');
assert.match(pdf, /^%PDF-1\.4/);
assert.match(pdf, /\/URI \(https:\/\/script\.google\.com\/x\?token=a\)/);
const xrefAt = Number(pdf.match(/startxref\n(\d+)/)[1]);
assert.equal(pdf.slice(xrefAt, xrefAt + 4), 'xref');
const firstObj = Number(pdf.match(/xref\n0 \d+\n0000000000 65535 f \n(\d{10})/)[1]);
assert.equal(pdf.slice(firstObj, firstObj + 7), '1 0 obj');
const long = 'Repassaré els apunts cada divendres i demanaré ajuda quan no entengui un concepte. ';
context.longModel = [{title: '', blocks: Array.from({length: 16}, (_, i) => ({title: 'Matèria ' + i,
  level: {code: '3', abbr: 'AN', name: 'Assoliment notable'},
  items: [{label: 'Compromís de millora', value: {text: long.repeat(i % 5 === 2 ? 9 : 1)}}]}))},
  {title: 'Una resposta molt llarga', blocks: [{title: 'Reflexió', level: null,
    items: [{label: 'Per què?', value: {text: long.repeat(120)}}]}]}];
const placed = [], originalDraw = context.drawCard_;
context.drawCard_ = (page, piece, top) => { placed.push({top, height: piece.height, title: piece.titleLines.length}); };
run('buildReportPdf_(longModel, meta)');
context.drawCard_ = originalDraw;
assert.ok(placed.length > 17);
placed.forEach(p => { assert.ok(p.top <= 841.89 - 128 + 0.01); assert.ok(p.top - p.height >= 54 - 0.01); });
assert.equal(placed.length - 16 > 1, true);
// Acusament de lectura al final, sencer dins la pàgina; el PDF conjunt comença cada informe en una cara anvers.
const slips = [], originalSlip = context.drawSlip_;
context.drawSlip_ = (page, m, top) => slips.push(top);
const pagesShort = run('layoutReport_(model, meta)').length, pagesLong = run('layoutReport_(longModel, meta)').length;
context.drawSlip_ = originalSlip;
assert.equal(slips.length, 2);
slips.forEach(top => { assert.ok(top <= 841.89 - 128 + 0.01); assert.ok(top - run('SLIP_HEIGHT') >= 54 - 0.01); });
assert.match(Buffer.from([...run('buildReportPdf_(model, meta)')].map(b => b & 255)).toString('latin1'), /<416375736[0-9a-f]*>/);
context.bundleIn = [{model, meta: context.meta}, {model: context.longModel, meta: context.meta}];
const bundle = Buffer.from([...run("buildBundlePdf_(bundleIn, 'Conjunt', true)")].map(b => b & 255)).toString('latin1');
const even = n => n + n % 2;
assert.equal(Number(bundle.match(/\/Count (\d+)/)[1]), even(pagesShort) + even(pagesLong));
assert.equal(run('reportModel_(structure, sampleAnswers_(structure)).length'), 3);
// Formulari de partida d'una recollida nova i origen de les recollides antigues.
state.campaigns = [['a', '1r.ESO', '2026-2027', 'Pre', 'formA', 'TANCADA', 'f', '2026-10-01T00:00:00', 'COPIA'],
  ['b', '1r.ESO', '2026-2027', '1a', 'formB', 'TANCADA', 'f', '2026-12-01T00:00:00', 'COPIA']];
state.templates = [];
assert.equal(run("sourceFormId_('1r.ESO', '')"), 'formB');
assert.throws(() => run("sourceFormId_('2n.ESO', '')"), /primera recollida/);
assert.equal(run("origin_(['x', '4t.ESO', '2026-2027', 'Pre', 'f', 'TANCADA', '', ''])"), 'HISTORICA');
assert.equal(run("origin_(['x', '4t.ESO', '2026-2027', 'Pre', 'f', 'TANCADA', 'carpeta', '', 'DIRECTE'])"), 'DIRECTE');

// Una recollida històrica conserva l'origen quan se li crea carpeta, i el professorat del curs hi té accés.
const shared = {folder: [], form: []};
const fakeFile = (kind, owner) => ({getOwner: () => ({getEmail: () => owner}), getEditors: () => [], getViewers: () => [],
  addViewers: list => shared[kind].push(...list), addEditors: list => shared[kind].push(...list)});
context.DriveApp = {getFolderById: () => ({...fakeFile('folder', 'admin@ramonpont.cat'), createFolder: () => ({getId: () => 'nova'})}),
  getFileById: () => fakeFile('form', 'admin@ramonpont.cat')};
context.config_ = key => key === 'ROOT_FOLDER_ID' ? 'arrel' : '';
state.access = [['admin@ramonpont.cat', '*', 'admin', 'SI'], ['tutor4@ramonpont.cat', '4t.ESO', 'tutor', 'SI'],
  ['tutor1@ramonpont.cat', '1r.ESO', 'tutor', 'SI'], ['antic@ramonpont.cat', '4t.ESO', 'tutor', 'NO']];
state.campaigns.push(['h', '4t.ESO', '2026-2027', 'Pre', 'formH', 'TANCADA', '', '2026-09-01T00:00:00']);
context.historic = state.campaigns[2];
run('ensureCampaignFolder_(historic)');
assert.equal(state.campaigns.find(r => r[0] === 'h')[6], 'nova');
assert.equal(run("origin_(rows_('campaigns').find(r => r[0] === 'h'))"), 'HISTORICA');
assert.deepEqual(shared.folder, ['tutor4@ramonpont.cat']);
assert.deepEqual(shared.form, [], 'el formulari històric no es comparteix');
assert.ok(savedCsv.length > 0, 'el CSV de famílies queda desat per tornar-lo a aplicar');
const coreOnly = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'Core.gs'), 'utf8'), coreOnly);
assert.throws(() => vm.runInContext("idFromUrl_('https://docs.google.com/forms/d/e/1FAIpQLSexemple/viewform')", coreOnly), /enllaç per respondre/);
assert.equal(vm.runInContext("idFromUrl_('https://docs.google.com/forms/d/1abcDEF_ghi-123456789012/edit')", coreOnly), '1abcDEF_ghi-123456789012');
console.log('Totes les comprovacions locals són correctes');
