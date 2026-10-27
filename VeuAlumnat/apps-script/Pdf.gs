/* Generador de PDF propi, sense dependències: Helvetica estàndard (WinAnsi) i mida A4.
   La maquetació es calcula abans de dibuixar: cada bloc va sencer a la pàgina on hi cap.
   Només un bloc més alt que una pàgina sencera es divideix, marcat com a «continuació». */
const PDF = Object.freeze({W: 595.28, H: 841.89, M: 42, TOP: 841.89 - 128, BOTTOM: 54, GAP: 12, PAD: 18});
const PDF_WIDTHS = {
  F1: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
  F2: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]
};
/* Colors pensats també per a impressió en blanc i negre: el text és sempre fosc (lluminositat < 40 %) sobre
   fons molt clars (> 90 %), i les vores són prou grises perquè no desapareguin. El color no porta mai informació sola. */
const PDF_COLORS = {red: [0x83, 0x1E, 0x12], gold: [0xB7, 0x8C, 0x00], goldTint: [0xFB, 0xF4, 0xDE], ink: [0x25, 0x25, 0x25],
  muted: [0x55, 0x55, 0x55], line: [0xB9, 0xB1, 0xA4], paper: [0xF8, 0xF6, 0xF2], white: [0xFF, 0xFF, 0xFF]};
const WINANSI_EXTRA = {'€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89,
  'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96,
  '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F};

function winAnsiChar_(ch) {
  const cp = ch.codePointAt(0);
  if ((cp >= 32 && cp <= 126) || (cp >= 160 && cp <= 255)) return [cp];
  if (WINANSI_EXTRA[ch]) return [WINANSI_EXTRA[ch]];
  if (cp === 9) return [32];
  if (cp === 0x140 || cp === 0x13F) return [cp === 0x140 ? 108 : 76, 0xB7];
  return [...ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')]
    .filter(c => /^[\x20-\x7e\xa0-\xff]$/.test(c)).map(c => c.charCodeAt(0));
}
/* Text → codis WinAnsi. Els caràcters que la lletra no té (emojis, altres alfabets) s'ometen. */
function winAnsi_(text) {
  const out = [];
  for (const ch of String(text == null ? '' : text).normalize('NFC')) winAnsiChar_(ch).forEach(c => out.push(c));
  return out;
}
function pdfWidth_(codes, font, size) {
  return codes.reduce((sum, c) => sum + (PDF_WIDTHS[font][c - 32] || 0), 0) * size / 1000;
}
function pdfWrap_(text, font, size, maxWidth) {
  const lines = [];
  String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').forEach(piece => {
    let line = [];
    piece.split(/ +/).filter(Boolean).map(winAnsi_).filter(w => w.length).forEach(word => {
      const candidate = line.length ? line.concat([32], word) : word;
      if (pdfWidth_(candidate, font, size) <= maxWidth) { line = candidate; return; }
      if (line.length) lines.push(line);
      line = [];
      word.forEach(c => {
        if (line.length && pdfWidth_(line.concat([c]), font, size) > maxWidth) { lines.push(line); line = []; }
        line.push(c);
      });
    });
    lines.push(line);
  });
  while (lines.length > 1 && !lines[lines.length - 1].length) lines.pop();
  return lines;
}

function pdfHex_(codes) { return '<' + codes.map(c => (c < 16 ? '0' : '') + c.toString(16)).join('') + '>'; }
function pdfNum_(n) { return String(Math.round(n * 100) / 100); }
function pdfColor_(rgb, op) { return rgb.map(v => pdfNum_(v / 255)).join(' ') + ' ' + op; }
function pdfText_(page, text, x, y, font, size, color, align) {
  const codes = Array.isArray(text) ? text : winAnsi_(text);
  if (!codes.length) return;
  const w = pdfWidth_(codes, font, size);
  const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  page.ops.push('BT /' + font + ' ' + pdfNum_(size) + ' Tf ' + pdfColor_(color, 'rg') + ' '
    + pdfNum_(left) + ' ' + pdfNum_(y) + ' Td ' + pdfHex_(codes) + ' Tj ET');
}
function pdfRoundRect_(page, x, y, w, h, r, fill, stroke) {
  const k = 0.5523 * r, n = pdfNum_;
  page.ops.push((fill ? pdfColor_(fill, 'rg') + ' ' : '') + (stroke ? pdfColor_(stroke, 'RG') + ' 0.8 w ' : '')
    + n(x + r) + ' ' + n(y) + ' m ' + n(x + w - r) + ' ' + n(y) + ' l '
    + n(x + w - r + k) + ' ' + n(y) + ' ' + n(x + w) + ' ' + n(y + r - k) + ' ' + n(x + w) + ' ' + n(y + r) + ' c '
    + n(x + w) + ' ' + n(y + h - r) + ' l '
    + n(x + w) + ' ' + n(y + h - r + k) + ' ' + n(x + w - r + k) + ' ' + n(y + h) + ' ' + n(x + w - r) + ' ' + n(y + h) + ' c '
    + n(x + r) + ' ' + n(y + h) + ' l '
    + n(x + r - k) + ' ' + n(y + h) + ' ' + n(x) + ' ' + n(y + h - r + k) + ' ' + n(x) + ' ' + n(y + h - r) + ' c '
    + n(x) + ' ' + n(y + r) + ' l '
    + n(x) + ' ' + n(y + r - k) + ' ' + n(x + r - k) + ' ' + n(y) + ' ' + n(x + r) + ' ' + n(y) + ' c h '
    + (fill && stroke ? 'B' : fill ? 'f' : 'S'));
}
function pdfLine_(page, x1, y1, x2, y2, color, width, dash) {
  page.ops.push(pdfColor_(color, 'RG') + ' ' + pdfNum_(width) + ' w ' + (dash ? '[' + dash + '] 0 d ' : '')
    + pdfNum_(x1) + ' ' + pdfNum_(y1) + ' m ' + pdfNum_(x2) + ' ' + pdfNum_(y2) + ' l S' + (dash ? ' [] 0 d' : ''));
}

/* Files d'una targeta amb la posició de la línia base respecte de la vora superior. */
function cardRows_(items, inner) {
  const rows = [];
  items.forEach(item => {
    rows.push({kind: 'label', codes: winAnsi_(String(item.label || '').toUpperCase()), gap: rows.length ? 22 : 0});
    const v = item.value, textRows = [];
    if (v.text) pdfWrap_(v.text, 'F1', 10.3, inner).forEach(l => textRows.push({kind: 'text', codes: l}));
    else if (v.list) v.list.forEach(x => pdfWrap_(x, 'F1', 10.3, inner - 12)
      .forEach((l, i) => textRows.push({kind: i ? 'text' : 'bullet', codes: l, indent: 12})));
    else v.table.forEach(r => pdfWrap_(r[0] + ': ' + r[1], 'F1', 10.3, inner).forEach(l => textRows.push({kind: 'text', codes: l})));
    textRows.forEach((r, i) => { r.gap = i ? 13.7 : 16.5; rows.push(r); });
  });
  return rows;
}

/* Divideix un bloc en targetes; normalment només una. */
function cardPieces_(block, width) {
  const inner = width - 2 * PDF.PAD, levelRoom = block.level ? 150 : 0;
  const titleLines = block.title ? pdfWrap_(block.title, 'F2', 12, inner - levelRoom) : [];
  const head = (titleLines.length || block.level ? 42 : 24) + Math.max(0, titleLines.length - 1) * 15;
  const capacity = PDF.TOP - PDF.BOTTOM;
  const pieces = [];
  let piece = {titleLines, level: block.level, rows: [], height: 0}, y = head - 0;
  const close = () => {
    const last = piece.rows.length ? piece.rows[piece.rows.length - 1].y
      : Math.max(piece.level ? 40 : 0, 26 + Math.max(0, piece.titleLines.length - 1) * 15);
    piece.height = Math.max(piece.level ? 58 : 40, last + 20, piece.rows.length && piece.level ? 81 : 0);
    pieces.push(piece);
  };
  cardRows_(block.items, inner).forEach((row, i) => {
    let at = i === 0 ? head + (row.kind === 'label' ? 0 : 8) : y + row.gap;
    if (at + 20 > capacity && piece.rows.length) {
      close();
      const contTitle = pdfWrap_((block.title || 'Respostes') + ' · continuació', 'F2', 12, inner);
      piece = {titleLines: contTitle, level: null, rows: [], height: 0};
      at = 42 + (contTitle.length - 1) * 15 + (row.kind === 'label' ? 0 : 8);
    }
    row.y = at; y = at;
    piece.rows.push(row);
  });
  close();
  return pieces;
}

function drawCard_(page, piece, top) {
  const x = PDF.M, w = PDF.W - 2 * PDF.M, right = x + w - PDF.PAD, left = x + PDF.PAD;
  pdfRoundRect_(page, x, top - piece.height, w, piece.height, 9, PDF_COLORS.paper, PDF_COLORS.line);
  piece.titleLines.forEach((l, i) => pdfText_(page, l, left, top - 26 - i * 15, 'F2', 12, PDF_COLORS.ink));
  const level = piece.level;
  if (level && level.code) {
    pdfText_(page, level.code + ' · ' + level.abbr, right, top - 26, 'F2', 10, PDF_COLORS.red, 'right');
    pdfText_(page, level.name, right, top - 40, 'F1', 8.5, PDF_COLORS.muted, 'right');
  } else if (level) pdfText_(page, level.text, right, top - 26, 'F2', 10, PDF_COLORS.red, 'right');
  piece.rows.forEach(r => {
    if (r.kind === 'label') pdfText_(page, r.codes, left, top - r.y, 'F2', 8, PDF_COLORS.muted);
    else {
      if (r.kind === 'bullet') pdfText_(page, [0x95], left, top - r.y, 'F1', 10.3, PDF_COLORS.red);
      pdfText_(page, r.codes, left + (r.indent || 0), top - r.y, 'F1', 10.3, PDF_COLORS.ink);
    }
  });
}

function drawFrame_(page, meta, number, total) {
  const W = PDF.W, H = PDF.H, logo = meta.logo;
  if (logo) {
    const s = 57 / Math.max(logo.width, logo.height), w = logo.width * s, h = logo.height * s;
    page.ops.unshift('q ' + pdfNum_(w) + ' 0 0 ' + pdfNum_(h) + ' ' + pdfNum_(PDF.M + (57 - w) / 2) + ' '
      + pdfNum_(H - 84 + (57 - h) / 2) + ' cm /Im1 Do Q');
  }
  pdfText_(page, 'Escola Ramon Pont', 112, H - 49, 'F2', 15, PDF_COLORS.red);
  pdfText_(page, 'LA VEU DE L’ALUMNAT', 112, H - 66, 'F1', 9, PDF_COLORS.muted);
  const badge = winAnsi_(String(meta.label).toUpperCase());
  const bw = Math.min(220, pdfWidth_(badge, 'F2', 8.5) + 24);
  pdfRoundRect_(page, W - PDF.M - bw, H - 68, bw, 24, 8, PDF_COLORS.goldTint, PDF_COLORS.gold);
  pdfText_(page, badge, W - PDF.M - bw / 2, H - 60.5, 'F2', 8.5, PDF_COLORS.red, 'center');
  pdfLine_(page, PDF.M, H - 99, W - PDF.M, H - 99, PDF_COLORS.line, 0.8);
  pdfText_(page, 'Autoavaluació de l’alumne/a · No substitueix l’informe d’avaluació del centre · ' + meta.generated,
    PDF.M, 28, 'F1', 8.5, PDF_COLORS.muted);
  pdfText_(page, number + ' / ' + total, W - PDF.M, 28, 'F1', 8.5, PDF_COLORS.muted, 'right');
}

/* Acusament de lectura per si l'informe es lliura imprès: es retalla per la línia i es torna al tutor o tutora. */
const SLIP_HEIGHT = 196;
function drawSlip_(page, meta, top) {
  const x = PDF.M, w = PDF.W - 2 * PDF.M, left = x + PDF.PAD, right = x + w - PDF.PAD;
  pdfLine_(page, x, top, x + w, top, PDF_COLORS.muted, 0.8, '4 3');
  pdfText_(page, 'Retalleu per aquesta línia i retorneu aquesta part al tutor o tutora', x + w / 2, top - 12,
    'F1', 8, PDF_COLORS.muted, 'center');
  const box = top - 22, h = SLIP_HEIGHT - 22;
  pdfRoundRect_(page, x, box - h, w, h, 9, PDF_COLORS.white, PDF_COLORS.line);
  pdfText_(page, 'Acusament de lectura', left, box - 24, 'F2', 12, PDF_COLORS.ink);
  pdfText_(page, meta.label + ' · ' + meta.course + ' · ' + meta.year, right, box - 24, 'F1', 8.5, PDF_COLORS.muted, 'right');
  pdfText_(page, 'Alumne/a: ' + meta.student, left, box - 42, 'F2', 10.3, PDF_COLORS.ink);
  pdfText_(page, 'Com a pare, mare o tutor/a legal, declaro que he llegit aquesta autoavaluació.', left, box - 60,
    'F1', 10.3, PDF_COLORS.ink);
  const field = (label, y, from, to) => {
    pdfText_(page, label, from, y, 'F1', 10, PDF_COLORS.ink);
    pdfLine_(page, from + pdfWidth_(winAnsi_(label), 'F1', 10) + 6, y - 2, to, y - 2, PDF_COLORS.muted, 0.6);
  };
  const mid = x + w * 0.58;
  field('Nom i cognoms:', box - 92, left, right);
  field('DNI/NIE:', box - 122, left, mid - 16);
  field('Data:', box - 122, mid, right);
  field('Signatura:', box - 160, left, mid - 16);
}

/* Maqueta l'informe complet i en retorna les pàgines, ja amb capçalera i peu. */
function layoutReport_(model, meta) {
  const pages = [], width = PDF.W - 2 * PDF.M, x = PDF.M;
  let page, y;
  const newPage = () => { page = {ops: [], links: []}; pages.push(page); y = PDF.TOP; };
  const fits = h => y - h >= PDF.BOTTOM;
  newPage();
  pdfText_(page, 'La meva autoavaluació', x, y - 21, 'F2', 23, PDF_COLORS.ink);
  y -= 34;
  pdfText_(page, meta.label + ' · ' + meta.course + ' · Curs ' + meta.year, x, y - 10, 'F1', 10, PDF_COLORS.muted);
  y -= 32;
  pdfRoundRect_(page, x, y - 45, width, 45, 3, PDF_COLORS.paper, PDF_COLORS.line);
  pdfText_(page, 'Alumne/a', x + 20, y - 26.5, 'F2', 11, PDF_COLORS.ink);
  pdfText_(page, meta.student, x + 100, y - 26.5, 'F1', 11, PDF_COLORS.ink);
  y -= 68;
  const intro = meta.legend
    ? 'He indicat el nivell que preveig assolir i què em comprometo a fer per millorar. Aquesta és la meva reflexió personal, no la qualificació del professorat.'
    : 'Aquest document recull la reflexió que he fet sobre el meu aprenentatge. És la meva valoració personal, no la qualificació del professorat.';
  pdfWrap_(intro, 'F1', 10.4, width).forEach(l => { pdfText_(page, l, x, y - 10.5, 'F1', 10.4, PDF_COLORS.ink); y -= 14.3; });
  y -= 15;
  if (meta.legend) {
    pdfText_(page, '1  NA · No assoliment     2  AS · Assoliment satisfactori', x, y - 9, 'F2', 8.9, PDF_COLORS.red);
    pdfText_(page, '3  AN · Assoliment notable     4  AE · Assoliment excel·lent', x, y - 22, 'F2', 8.9, PDF_COLORS.red);
    y -= 46;
  }
  model.forEach(section => {
    const pieces = section.blocks.map(b => cardPieces_(b, width));
    if (section.title) {
      const firstHeight = pieces.length ? pieces[0][0].height : 0;
      if (!fits(38 + firstHeight)) newPage(); else if (y < PDF.TOP) y -= 8;
      pdfText_(page, section.title, x, y - 14, 'F2', 13, PDF_COLORS.red);
      pdfLine_(page, x, y - 22, x + width, y - 22, PDF_COLORS.line, 0.8);
      y -= 30;
    }
    pieces.forEach(list => list.forEach(piece => {
      if (!fits(piece.height)) newPage();
      drawCard_(page, piece, y);
      y -= piece.height + PDF.GAP;
    }));
  });
  if (!model.length) { pdfText_(page, 'No hi ha respostes per mostrar.', x, y - 12, 'F1', 10.3, PDF_COLORS.ink); y -= 24; }
  if (meta.confirmUrl) {
    if (!fits(70)) newPage();
    pdfRoundRect_(page, x, y - 58, width, 58, 9, PDF_COLORS.paper, PDF_COLORS.line);
    pdfText_(page, 'Confirmació de lectura', x + PDF.PAD, y - 26, 'F2', 12, PDF_COLORS.ink);
    pdfText_(page, 'He llegit l’autoavaluació del meu fill o filla · Confirmeu-ho aquí', x + PDF.PAD, y - 44, 'F2', 10.3, PDF_COLORS.red);
    page.links.push({rect: [x, y - 58, x + width, y], url: meta.confirmUrl});
    y -= 58 + PDF.GAP;
  }
  /* Separat del contingut i, si cal, sol a la pàgina següent: es pot retallar sense perdre res de l'informe. */
  if (!fits(28 + SLIP_HEIGHT)) newPage(); else y -= 28;
  drawSlip_(page, meta, y);
  pages.forEach((p, i) => drawFrame_(p, meta, i + 1, pages.length));
  return pages;
}

function buildReportPdf_(model, meta) {
  return pdfBytes_(layoutReport_(model, meta), meta.logo, meta.title || 'Autoavaluació');
}

/* Un sol PDF amb diversos informes per imprimir-los de cop. Amb duplex, cada informe comença en una
   cara anvers: s'hi afegeix una pàgina en blanc quan en té un nombre senar. */
function buildBundlePdf_(reports, title, duplex) {
  const pages = [];
  reports.forEach(r => {
    const own = layoutReport_(r.model, r.meta);
    own.forEach(p => pages.push(p));
    if (duplex && own.length % 2) pages.push({ops: [], links: []});
  });
  return pdfBytes_(pages, reports.length ? reports[0].meta.logo : '', title);
}

function pdfUtf16_(s) {
  return '<FEFF' + [...String(s)].map(ch => {
    const cp = ch.codePointAt(0);
    const units = cp > 0xFFFF ? [0xD800 + ((cp - 0x10000) >> 10), 0xDC00 + ((cp - 0x10000) & 0x3FF)] : [cp];
    return units.map(u => ('000' + u.toString(16)).slice(-4)).join('');
  }).join('') + '>';
}

/* Serialitza les pàgines en un PDF 1.4. Retorna bytes amb signe, com els que accepta Utilities.newBlob. */
function pdfBytes_(pages, logo, title) {
  const objs = [];
  const add = o => { objs.push(o); return objs.length; };
  add(null); add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  let img = 0;
  if (logo) {
    const space = logo.comps === 1 ? '/DeviceGray' : logo.comps === 4 ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]' : '/DeviceRGB';
    img = add({dict: '<< /Type /XObject /Subtype /Image /Width ' + logo.width + ' /Height ' + logo.height
      + ' /ColorSpace ' + space + ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + logo.bytes.length + ' >>', bytes: logo.bytes});
  }
  const info = add('<< /Title ' + pdfUtf16_(title) + ' /Producer (La veu de l\'alumnat) >>');
  const kids = pages.map(p => {
    const content = p.ops.join('\n');
    const c = add({dict: '<< /Length ' + content.length + ' >>', text: content});
    const annots = p.links.map(l => add('<< /Type /Annot /Subtype /Link /Rect [' + l.rect.map(pdfNum_).join(' ')
      + '] /Border [0 0 0] /A << /S /URI /URI (' + String(l.url).replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '') + ') >> >>'));
    return add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PDF.W + ' ' + PDF.H + '] /Resources << /Font << /F1 '
      + f1 + ' 0 R /F2 ' + f2 + ' 0 R >>' + (img ? ' /XObject << /Im1 ' + img + ' 0 R >>' : '') + ' >> /Contents '
      + c + ' 0 R' + (annots.length ? ' /Annots [' + annots.map(a => a + ' 0 R').join(' ') + ']' : '') + ' >>');
  });
  objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[1] = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
  const out = [], offsets = [];
  const str = s => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 255); };
  str('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  objs.forEach((o, i) => {
    offsets.push(out.length);
    str((i + 1) + ' 0 obj\n');
    if (typeof o === 'string') str(o);
    else {
      str(o.dict + '\nstream\n');
      if (o.text !== undefined) str(o.text); else o.bytes.forEach(b => out.push(b & 255));
      str('\nendstream');
    }
    str('\nendobj\n');
  });
  const xref = out.length;
  str('xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n');
  offsets.forEach(o => str(('000000000' + o).slice(-10) + ' 00000 n \n'));
  str('trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return out.map(b => b > 127 ? b - 256 : b);
}

function jpegInfo_(bytes) {
  const b = i => bytes[i] & 255;
  if (b(0) !== 0xFF || b(1) !== 0xD8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (b(i) !== 0xFF) { i++; continue; }
    const m = b(i + 1);
    if (m === 0xFF) { i++; continue; }
    if (m === 0x01 || (m >= 0xD0 && m <= 0xD8)) { i += 2; continue; }
    if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) {
      return {height: (b(i + 5) << 8) | b(i + 6), width: (b(i + 7) << 8) | b(i + 8), comps: b(i + 9)};
    }
    i += 2 + ((b(i + 2) << 8) | b(i + 3));
  }
  return null;
}

let logoCache_ = null;
/* El logotip es desa tal com es carrega; si no és JPEG, Drive el converteix (el PDF l'incrusta en JPEG). */
function logoJpeg_() {
  if (logoCache_ !== null) return logoCache_;
  const id = config_('LOGO_FILE_ID');
  if (!id) return (logoCache_ = '');
  let blob = DriveApp.getFileById(id).getBlob();
  if (blob.getContentType() !== 'image/jpeg') blob = blob.getAs('image/jpeg');
  const bytes = blob.getBytes(), info = jpegInfo_(bytes);
  return (logoCache_ = info ? Object.assign({bytes}, info) : '');
}
