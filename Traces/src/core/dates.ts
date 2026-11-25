// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Llegeix dates de lliurament tal com les mostra Google Classroom en català,
 * castellà o anglès («28 de nov., 23:59», «28 nov 2026», «Nov 28, 11:59 PM», «demà, 9:00»…).
 */

const MONTHS: Array<[RegExp, number]> = [
  [/^(gen|ene|jan)/i, 0],
  [/^(febr?|feb)/i, 1],
  [/^(març|marc|mar)/i, 2],
  [/^(abr|apr)/i, 3],
  [/^(maig|may)/i, 4],
  [/^(juny|jun)/i, 5],
  [/^(jul)/i, 6],
  [/^(ag|aug)/i, 7],
  [/^(set|sep)/i, 8],
  [/^(oct|out)/i, 9],
  [/^(nov)/i, 10],
  [/^(des|dic|dec)/i, 11],
];

function monthFromWord(word: string): number | null {
  const w = word.toLowerCase().replace(/[.,]/g, '');
  for (const [re, m] of MONTHS) if (re.test(w)) return m;
  return null;
}

function applyTime(date: Date, text: string): void {
  const m = text.match(/(\d{1,2})[:.h](\d{2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3]?.toLowerCase().replace(/[.\s]/g, '');
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    date.setHours(h, min, 0, 0);
  } else {
    date.setHours(23, 59, 0, 0);
  }
}

export function parseLooseDate(text: string, now: Date = new Date()): number | null {
  const t = text.trim();
  if (!t) return null;

  const rel = t.match(/(?<![\p{L}])(avui|hoy|today|demà|dema|mañana|manana|tomorrow|ahir|ayer|yesterday)(?![\p{L}])/iu);
  if (rel) {
    const d = new Date(now);
    const w = rel[1].toLowerCase();
    if (/dem|mañ|man|tom/.test(w)) d.setDate(d.getDate() + 1);
    if (/ahir|ayer|yest/.test(w)) d.setDate(d.getDate() - 1);
    applyTime(d, t);
    return d.getTime();
  }

  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  // 28/11/2026 o 28-11
  const num = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (num) {
    day = parseInt(num[1], 10);
    month = parseInt(num[2], 10) - 1;
    if (num[3]) year = parseInt(num[3], 10) + (num[3].length === 2 ? 2000 : 0);
  } else {
    // «28 de nov.», «28 nov 2026», «Nov 28, 2026»
    const dm = t.match(/\b(\d{1,2})\s+(?:de\s+|d[’'])?([a-zçà]{3,}\.?)(?:\s+(?:de\s+)?(\d{4}))?/i);
    const md = t.match(/\b([a-z]{3,}\.?)\s+(\d{1,2})(?:,?\s+(\d{4}))?/i);
    if (dm && monthFromWord(dm[2]) !== null) {
      day = parseInt(dm[1], 10);
      month = monthFromWord(dm[2]);
      if (dm[3]) year = parseInt(dm[3], 10);
    } else if (md && monthFromWord(md[1]) !== null) {
      month = monthFromWord(md[1]);
      day = parseInt(md[2], 10);
      if (md[3]) year = parseInt(md[3], 10);
    }
  }

  if (day === null || month === null || day < 1 || day > 31 || month < 0 || month > 11) return null;

  const d = new Date(year ?? now.getFullYear(), month, day);
  applyTime(d, t.replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/, ''));
  // Sense any: si la data queda massa lluny en el futur, és del curs anterior
  if (year === null && d.getTime() - now.getTime() > 200 * 24 * 3600_000) d.setFullYear(d.getFullYear() - 1);
  return d.getTime();
}

const DUE_KEYWORDS =
  /(data de venciment|venciment|venç|data de lliurament|data límit|fecha de entrega|fecha límite|vence|due date|due)\s*:?\s*(.+)/i;

/** Cerca la data de lliurament dins d'un text de pàgina (p. ex. la capçalera del qualificador). */
export function findDueDateInText(pageText: string, now: Date = new Date()): number | null {
  for (const line of pageText.split('\n')) {
    const m = line.match(DUE_KEYWORDS);
    if (!m) continue;
    const ts = parseLooseDate(m[2], now);
    if (ts) return ts;
  }
  return null;
}
