/**
 * La vostra opinió · Valoració de les famílies (Escola Ramon Pont)
 * Formulari web en català, castellà i darija que desa les respostes
 * en un full de càlcul de Google amb resum visual per curs escolar.
 */

const NOM_FULL = 'Valoració de les famílies · Escola Ramon Pont';
const PESTANYA = { resum: '📊 Resum', frases: '💬 Frases', respostes: '🗂️ Respostes', llistes: 'Llistes' };

const MOTIUS = {
  projecte: 'Projecte educatiu i metodologia',
  proximitat: 'Proximitat al domicili o al lloc de treball',
  tracte: 'Tracte familiar, proper i acollidor',
  reputacio: "Bona reputació / Recomanació d'altres famílies",
  installacions: 'Instal·lacions, espais exteriors i aules',
  serveis: "Serveis d'acollida, menjador o extraescolars"
};

const VALORS = {
  adaptacio: "L'adaptació i el benestar del meu fill/a",
  atencio: "L'atenció i l'acompanyament de les mestres",
  comunicacio: 'La comunicació i la relació amb la família',
  clima: 'El clima de convivència i la comunitat escolar'
};

const IDIOMES = { ca: 'Català', es: 'Castellà', ar: 'Darija' };

const CAPCALERES = [
  'Data i hora', 'Curs escolar', 'Idioma',
  '1. Motius de tria', '1. Altre motiu',
  '2. El que més valoren', '2. Altre aspecte',
  '3. Frase (original)', '3. Frase en català',
  '4. Recomanació (1-10)'
];

const COLOR = {
  granat: '#8B1E14', granatClar: '#F6E7E4', or: '#C9971C', orClar: '#FBF3DC',
  verd: '#2E7D32', verdClar: '#E5F2E6', groc: '#F2B400', vermell: '#C62828',
  gris: '#5F6368', grisClar: '#F4F5F7', blanc: '#FFFFFF'
};

/* ---------- Web ---------- */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('La vostra opinió · Escola Ramon Pont')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nom) {
  return HtmlService.createHtmlOutputFromFile(nom).getContent();
}

/** Curs escolar de setembre a juny: de setembre en endavant comença el curs nou. */
function cursEscolar(data) {
  const d = data || new Date();
  const any = Number(Utilities.formatDate(d, 'Europe/Madrid', 'yyyy'));
  const mes = Number(Utilities.formatDate(d, 'Europe/Madrid', 'M'));
  return mes >= 9 ? any + '-' + (any + 1) : (any - 1) + '-' + any;
}

function cursActual() {
  return cursEscolar(new Date());
}

/** Rep la resposta del formulari, la valida i la desa. */
function desaResposta(resposta) {
  const r = valida_(resposta);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = obreFull_();
    const full = ss.getSheetByName(PESTANYA.respostes);
    const ara = new Date();
    const curs = cursEscolar(ara);
    const fila = [
      ara, curs, IDIOMES[r.idioma],
      r.motius.map(k => MOTIUS[k]).join('\n'),
      ambTraduccio_(r.altreMotiu, r.idioma),
      r.valors.map(k => VALORS[k]).join('\n'),
      ambTraduccio_(r.altreValor, r.idioma),
      segur_(r.frase),
      r.frase && r.idioma !== 'ca' ? segur_(tradueix_(r.frase)) : '',
      r.nota
    ];
    const n = full.getLastRow() + 1;
    full.getRange(n, 1, 1, fila.length).setValues([fila]);
    full.getRange(n, 1).setNumberFormat('dd/mm/yyyy hh:mm');
    actualitzaCursos_(ss, curs);
    return { ok: true, curs: curs };
  } finally {
    lock.releaseLock();
  }
}

function valida_(x) {
  if (!x || typeof x !== 'object') throw new Error('Resposta buida');
  const idioma = IDIOMES[x.idioma] ? x.idioma : 'ca';
  const filtra = (llista, cataleg) => Array.isArray(llista)
    ? llista.filter((k, i) => cataleg[k] && llista.indexOf(k) === i) : [];
  const text = (t, max) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const r = {
    idioma: idioma,
    motius: filtra(x.motius, MOTIUS).slice(0, 3),
    altreMotiu: text(x.altreMotiu, 300),
    valors: filtra(x.valors, VALORS),
    altreValor: text(x.altreValor, 300),
    frase: text(x.frase, 600),
    nota: Number(x.nota)
  };
  if (r.motius.length + (r.altreMotiu ? 1 : 0) === 0 || r.motius.length + (r.altreMotiu ? 1 : 0) > 3) throw new Error('Pregunta 1');
  if (r.valors.length + (r.altreValor ? 1 : 0) === 0) throw new Error('Pregunta 2');
  if (!(r.nota >= 1 && r.nota <= 10 && Math.round(r.nota) === r.nota)) throw new Error('Pregunta 4');
  return r;
}

/** Evita que un text escrit per una família s'interpreti com una fórmula. */
function segur_(t) {
  return t && /^[=+\-@]/.test(t) ? "'" + t : (t || '');
}

function tradueix_(t) {
  try { return LanguageApp.translate(t, '', 'ca'); } catch (e) { return ''; }
}

function ambTraduccio_(t, idioma) {
  if (!t) return '';
  if (idioma === 'ca') return segur_(t);
  const ca = tradueix_(t);
  return segur_(ca ? t + '\n→ ' + ca : t);
}

function obreFull_() {
  const id = PropertiesService.getScriptProperties().getProperty('FULL_ID');
  if (!id) throw new Error("Encara no s'ha executat «configura»");
  return SpreadsheetApp.openById(id);
}

function actualitzaCursos_(ss, curs) {
  const resum = ss.getSheetByName(PESTANYA.resum);
  const cel = resum.getRange('C4');
  if (!cel.getValue()) cel.setValue(curs);
}

/* ---------- Configuració del full ---------- */

/**
 * Executa-la una sola vegada des de l'editor: crea el full de càlcul,
 * en desa l'identificador i en prepara l'estètica.
 */
function configura() {
  if (!Session.getActiveUser().getEmail()) throw new Error("Executeu «configura» des de l'editor d'Apps Script");
  const props = PropertiesService.getScriptProperties();
  let ss;
  const id = props.getProperty('FULL_ID');
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create(NOM_FULL);
    props.setProperty('FULL_ID', ss.getId());
  }
  // Les fórmules s'escriuen amb sintaxi anglesa (comes); després el full passa al català.
  ss.setSpreadsheetLocale('en_US');
  ss.setSpreadsheetTimeZone('Europe/Madrid');
  SpreadsheetApp.flush();

  const respostes = preparaRespostes_(ss);
  const llistes = preparaLlistes_(ss);
  const resum = preparaResum_(ss);
  const frases = preparaFrases_(ss);

  ss.setActiveSheet(resum);
  ss.moveActiveSheet(1);
  ss.setActiveSheet(frases);
  ss.moveActiveSheet(2);
  ss.setActiveSheet(respostes);
  ss.moveActiveSheet(3);
  ss.setActiveSheet(resum);
  llistes.hideSheet();
  ss.getSheets().forEach(s => {
    if (!Object.values(PESTANYA).includes(s.getName())) ss.deleteSheet(s);
  });
  SpreadsheetApp.flush();
  ss.setSpreadsheetLocale('ca_ES');
  Logger.log('Full preparat: ' + ss.getUrl());
  return ss.getUrl();
}

/** Barra horitzontal dins d'una cel·la (valor entre 0 i 1). */
function barra_(cel, color) {
  return '=SPARKLINE(' + cel + ',{"charttype","bar";"max",1;"color1","' + color + '"})';
}

function pestanya_(ss, nom) {
  return ss.getSheetByName(nom) || ss.insertSheet(nom);
}

function preparaRespostes_(ss) {
  const sh = pestanya_(ss, PESTANYA.respostes);
  sh.setTabColor(COLOR.gris);
  if (sh.getMaxColumns() > CAPCALERES.length) sh.deleteColumns(CAPCALERES.length + 1, sh.getMaxColumns() - CAPCALERES.length);
  sh.getRange(1, 1, 1, CAPCALERES.length).setValues([CAPCALERES])
    .setBackground(COLOR.granat).setFontColor(COLOR.blanc).setFontWeight('bold')
    .setFontSize(11).setVerticalAlignment('middle').setWrap(true);
  sh.setRowHeight(1, 44);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);
  [140, 95, 85, 290, 200, 290, 200, 300, 300, 115].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  const cos = sh.getRange(2, 1, sh.getMaxRows() - 1, CAPCALERES.length);
  cos.setVerticalAlignment('top').setWrap(true).setFontSize(10).setFontFamily('Roboto');
  sh.getRange('A2:A').setNumberFormat('dd/mm/yyyy hh:mm');
  sh.getRange('B2:C').setHorizontalAlignment('center');
  sh.getRange('J2:J').setHorizontalAlignment('center').setFontWeight('bold').setFontSize(12);
  sh.getRange('I2:I').setFontColor('#3C4043').setFontStyle('italic');
  sh.getBandings().forEach(b => b.remove());
  sh.getRange(1, 1, sh.getMaxRows(), CAPCALERES.length)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
    .setHeaderRowColor(COLOR.granat).setFirstRowColor(COLOR.blanc).setSecondRowColor(COLOR.grisClar);
  const nota = sh.getRange('J2:J');
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(9, 10)
      .setBackground(COLOR.verdClar).setFontColor(COLOR.verd).setRanges([nota]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(7, 8)
      .setBackground(COLOR.orClar).setFontColor('#8A6100').setRanges([nota]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(1, 6)
      .setBackground('#FDECEA').setFontColor(COLOR.vermell).setRanges([nota]).build()
  ]);
  sh.getRange(1, 1).setNote("Una fila per resposta. No cal tocar res: el Resum i les Frases s'actualitzen sols.");
  return sh;
}

function preparaLlistes_(ss) {
  const sh = pestanya_(ss, PESTANYA.llistes);
  sh.clear();
  const R = "'" + PESTANYA.respostes + "'";
  sh.getRange('A1').setValue('Cursos');
  sh.getRange('A2').setFormula('=IFERROR(SORT(UNIQUE(FILTER(' + R + '!B2:B,' + R + '!B2:B<>"")),1,FALSE),"' + cursActual() + '")');
  return sh;
}

function preparaResum_(ss) {
  const sh = pestanya_(ss, PESTANYA.resum);
  sh.clear();
  sh.clearConditionalFormatRules();
  sh.getRange('A1:H80').clearDataValidations();
  sh.setTabColor(COLOR.granat);
  sh.setHiddenGridlines(true);
  if (sh.getMaxColumns() > 8) sh.deleteColumns(9, sh.getMaxColumns() - 8);
  if (sh.getMaxRows() < 60) sh.insertRowsAfter(sh.getMaxRows(), 60 - sh.getMaxRows());
  [24, 360, 95, 110, 230, 24, 24, 24].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange('A1:H60').setFontFamily('Roboto').setFontSize(11).setVerticalAlignment('middle');

  const R = "'" + PESTANYA.respostes + "'";
  const CURS = '$C$4';
  const TOTAL = '$B$8';

  // Títol
  sh.getRange('B1:E1').merge().setValue('Què en pensen les famílies?')
    .setFontSize(20).setFontWeight('bold').setFontColor(COLOR.blanc).setBackground(COLOR.granat)
    .setHorizontalAlignment('left');
  sh.getRange('B2:E2').merge().setValue('Escola Ramon Pont · Qüestionari de valoració i tria d\'escola')
    .setFontColor(COLOR.granat).setBackground(COLOR.granatClar).setFontStyle('italic');
  sh.setRowHeight(1, 52);
  sh.setRowHeight(2, 28);
  sh.getRange('A1:A2').setBackground(COLOR.granat);
  sh.getRange('A2').setBackground(COLOR.granatClar);

  // Selector de curs
  sh.getRange('B4').setValue('📅  Curs escolar (trieu-lo aquí) →').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('C4:D4').merge().setValue(cursActual())
    .setBackground(COLOR.orClar).setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center')
    .setBorder(true, true, true, true, false, false, COLOR.or, SpreadsheetApp.BorderStyle.SOLID_MEDIUM)
    .setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(ss.getRange("'" + PESTANYA.llistes + "'!A2:A"), true).build());
  sh.setRowHeight(4, 36);

  // Targetes de xifres clau
  const targetes = [
    ['B', 'Respostes rebudes', '=COUNTIF(' + R + '!B2:B,' + CURS + ')', '0'],
    ['C', 'Nota mitjana', '=IFERROR(ROUND(AVERAGEIF(' + R + '!B2:B,' + CURS + ',' + R + '!J2:J),1),"—")', '0.0'],
    ['D', 'Recomanen molt (9-10)', '=IFERROR(COUNTIFS(' + R + '!B2:B,' + CURS + ',' + R + '!J2:J,">=9")/' + TOTAL + ',"—")', '0%'],
    ['E', 'Idioma: català · castellà · darija', '=COUNTIFS(' + R + '!B2:B,' + CURS + ',' + R + '!C2:C,"Català")&"  ·  "&COUNTIFS(' + R + '!B2:B,' + CURS + ',' + R + '!C2:C,"Castellà")&"  ·  "&COUNTIFS(' + R + '!B2:B,' + CURS + ',' + R + '!C2:C,"Darija")', '@']
  ];
  targetes.forEach(([col, etiqueta, formula, format]) => {
    sh.getRange(col + '7').setValue(etiqueta).setFontSize(9).setFontColor(COLOR.gris).setWrap(true)
      .setHorizontalAlignment('center').setBackground(COLOR.grisClar);
    sh.getRange(col + '8').setFormula(formula).setNumberFormat(format).setFontSize(22).setFontWeight('bold')
      .setFontColor(COLOR.granat).setHorizontalAlignment('center').setBackground(COLOR.grisClar);
  });
  sh.getRange('E8').setFontSize(16);
  sh.getRange('B7:E8').setBorder(true, true, true, true, true, false, COLOR.blanc, SpreadsheetApp.BorderStyle.SOLID_THICK);
  sh.setRowHeight(7, 30);
  sh.setRowHeight(8, 50);

  let fila = 10;
  fila = bloc_(sh, fila, '1 · Per què van triar l\'escola?', '(màxim 3 respostes per família)',
    Object.values(MOTIUS), 'D', 'E', R, CURS, TOTAL, COLOR.granat);
  fila = bloc_(sh, fila + 1, '2 · Què és el que més valoren?', '(poden triar-ne més d\'una)',
    Object.values(VALORS), 'F', 'G', R, CURS, TOTAL, COLOR.or);
  fila = blocNotes_(sh, fila + 1, R, CURS);

  sh.getRange('B' + (fila + 1) + ':E' + (fila + 1)).merge()
    .setValue('💬  Les frases per recomanar l\'escola són a la pestanya «Frases».  🗂️  Totes les respostes, a «Respostes».')
    .setFontColor(COLOR.gris).setFontStyle('italic').setWrap(true);
  return sh;
}

/** Bloc d'opcions amb vots, percentatge i barra. */
function bloc_(sh, fila, titol, subtitol, opcions, colOpcio, colAltre, R, CURS, TOTAL, color) {
  sh.getRange('B' + fila + ':E' + fila).merge().setValue(titol + '   ' + subtitol)
    .setFontWeight('bold').setFontSize(13).setFontColor(COLOR.blanc).setBackground(color);
  sh.setRowHeight(fila, 34);
  fila++;
  sh.getRange('B' + fila + ':E' + fila).setValues([['Resposta', 'Famílies', '% famílies', '']])
    .setFontWeight('bold').setFontColor(COLOR.gris).setFontSize(9);
  sh.getRange('C' + fila + ':D' + fila).setHorizontalAlignment('center');
  const inici = fila + 1;
  const files = opcions.concat(['Altre (vegeu «Respostes»)']);
  files.forEach((op, i) => {
    const f = inici + i;
    const vots = i < opcions.length
      ? '=COUNTIFS(' + R + '!B2:B,' + CURS + ',' + R + '!' + colOpcio + '2:' + colOpcio + ',"*"&B' + f + '&"*")'
      : '=COUNTIFS(' + R + '!B2:B,' + CURS + ',' + R + '!' + colAltre + '2:' + colAltre + ',"<>")';
    sh.getRange('B' + f).setValue(op).setWrap(true);
    sh.getRange('C' + f).setFormula(vots).setHorizontalAlignment('center').setFontWeight('bold').setFontSize(13);
    sh.getRange('D' + f).setFormula('=IFERROR(C' + f + '/' + TOTAL + ',0)').setNumberFormat('0%').setHorizontalAlignment('center');
    sh.getRange('E' + f).setFormula(barra_('D' + f, color));
    sh.setRowHeight(f, 30);
  });
  const fi = inici + files.length - 1;
  sh.getRange('B' + inici + ':E' + fi)
    .setBorder(null, null, true, null, false, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);
  // Ressalta l'opció més votada
  sh.setConditionalFormatRules(sh.getConditionalFormatRules().concat([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($C' + inici + '>0,$C' + inici + '=MAX($C$' + inici + ':$C$' + fi + '))')
      .setBackground(color === COLOR.granat ? COLOR.granatClar : COLOR.orClar).setBold(true)
      .setRanges([sh.getRange('B' + inici + ':D' + fi)]).build()
  ]));
  return fi + 1;
}

/** Distribució de les notes de l'1 al 10, amb colors semàfor. */
function blocNotes_(sh, fila, R, CURS) {
  sh.getRange('B' + fila + ':E' + fila).merge()
    .setValue('4 · Recomanarien l\'escola? (de l\'1 al 10)').setFontWeight('bold').setFontSize(13)
    .setFontColor(COLOR.blanc).setBackground(COLOR.verd);
  sh.setRowHeight(fila, 34);
  fila++;
  sh.getRange('B' + fila + ':E' + fila).setValues([['Nota', 'Famílies', '%', '']])
    .setFontWeight('bold').setFontColor(COLOR.gris).setFontSize(9);
  sh.getRange('C' + fila + ':D' + fila).setHorizontalAlignment('center');
  const inici = fila + 1;
  const fi = inici + 9;
  for (let n = 10; n >= 1; n--) {
    const f = inici + (10 - n);
    const color = n >= 9 ? COLOR.verd : n >= 7 ? COLOR.groc : COLOR.vermell;
    const cara = n >= 9 ? '😍' : n >= 7 ? '🙂' : n >= 5 ? '😐' : '🙁';
    sh.getRange('B' + f).setValue(n).setNumberFormat('"' + cara + '  "0').setHorizontalAlignment('left').setFontWeight('bold');
    sh.getRange('C' + f).setFormula('=COUNTIFS(' + R + '!B2:B,' + CURS + ',' + R + '!J2:J,B' + f + ')')
      .setHorizontalAlignment('center').setFontWeight('bold');
    sh.getRange('D' + f).setFormula('=IFERROR(C' + f + '/$B$8,0)').setNumberFormat('0%').setHorizontalAlignment('center');
    sh.getRange('E' + f).setFormula(barra_('D' + f, color));
    sh.setRowHeight(f, 26);
  }
  sh.getRange('B' + inici + ':E' + fi)
    .setBorder(null, null, true, null, false, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);
  const llegenda = fi + 1;
  sh.getRange('B' + llegenda + ':E' + llegenda).merge()
    .setValue('🟢 9-10: recomanarien molt   🟡 7-8: en dubte   🔴 1-6: poc probable')
    .setFontSize(9).setFontColor(COLOR.gris);
  return llegenda + 1;
}

function preparaFrases_(ss) {
  const sh = pestanya_(ss, PESTANYA.frases);
  sh.clear();
  sh.setTabColor(COLOR.or);
  sh.setHiddenGridlines(true);
  if (sh.getMaxColumns() > 5) sh.deleteColumns(6, sh.getMaxColumns() - 5);
  [24, 120, 420, 420, 90].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange('B1:E1').merge().setValue('💬  Com descriuen l\'escola les famílies')
    .setFontSize(18).setFontWeight('bold').setFontColor(COLOR.blanc).setBackground(COLOR.or);
  sh.getRange('A1').setBackground(COLOR.or);
  sh.setRowHeight(1, 48);
  sh.getRange('B2:E2').merge()
    .setFormula('="Curs "&\'' + PESTANYA.resum + '\'!C4&" · es canvia a la pestanya Resum. Ideal per a les portes obertes."')
    .setFontColor(COLOR.gris).setFontStyle('italic');
  sh.getRange('B4:E4').setValues([['Idioma', 'Frase original', 'Frase en català (traducció automàtica)', 'Nota']])
    .setBackground(COLOR.orClar).setFontWeight('bold').setFontColor('#6B4E00');
  sh.setFrozenRows(4);
  const R = "'" + PESTANYA.respostes + "'";
  sh.getRange('B5').setFormula(
    '=IFERROR(SORT(FILTER({' + R + '!C2:C,' + R + '!H2:H,IF(' + R + '!I2:I="",' + R + '!H2:H,' + R + '!I2:I),' + R + '!J2:J},' +
    R + '!B2:B=\'' + PESTANYA.resum + '\'!C4,' + R + '!H2:H<>""),4,FALSE),"Encara no hi ha frases per a aquest curs.")');
  sh.getRange('B5:E400').setWrap(true).setVerticalAlignment('top').setFontSize(11).setFontFamily('Roboto');
  sh.getRange('C5:C400').setFontSize(12);
  sh.getRange('B5:B400').setHorizontalAlignment('center').setFontColor(COLOR.gris);
  sh.getRange('E5:E400').setHorizontalAlignment('center').setFontWeight('bold');
  sh.getBandings().forEach(b => b.remove());
  sh.getRange('B4:E400').applyRowBanding(SpreadsheetApp.BandingTheme.YELLOW, true, false)
    .setHeaderRowColor(COLOR.orClar).setFirstRowColor(COLOR.blanc).setSecondRowColor('#FFFBF0');
  return sh;
}
