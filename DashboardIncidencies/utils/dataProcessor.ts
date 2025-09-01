import type { Incident, UnknownTypeInfo, Course, IncidentType } from '../types';
import { COURSE_NORMALIZATION_MAP, INCIDENT_TYPE_NORMALIZATION_MAP, OFFICIAL_INCIDENT_TYPES, TYPES_REQUIRING_QUANTITY } from '../constants';

const normalizeString = (str: string) => str.toLowerCase().trim().replace(/['’]/g, "'");

const getNormalizedCourse = (value: string): Course | null => {
    const normalized = normalizeString(value);
    return COURSE_NORMALIZATION_MAP[normalized] || null;
}

const getNormalizedIncidentType = (value: string): IncidentType | null => {
    const normalized = normalizeString(value);
    return INCIDENT_TYPE_NORMALIZATION_MAP[normalized] || null;
}

// A robust CSV parser to handle quoted fields containing commas (e.g., "Cognom, Nom")
const parseCSV = (csv: string): { headers: string[], rows: string[][] } => {
    const lines = csv.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i+1] === '"') {
                    // This is an escaped quote (e.g., "" within a quoted field)
                    current += '"';
                    i++; // Skip the next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);

    return { headers, rows };
};

export const processCsvData = (csvData: string): { cleanedData: Incident[], unknownTypes: UnknownTypeInfo[] } => {
  const { headers, rows } = parseCSV(csvData);

  const headerMap: { [key: string]: number } = {};
  headers.forEach((h, i) => {
    const lowerH = h.toLowerCase();
    if (lowerH.includes('alumne')) headerMap.alumne = i;
    if (lowerH.includes('curs')) headerMap.curs = i;
    if (lowerH.includes('tipus')) headerMap.tipus = i;
    if (lowerH.includes('quantitat')) headerMap.quantitat = i;
  });

  if (headerMap.alumne === undefined || headerMap.curs === undefined || headerMap.tipus === undefined) {
    throw new Error("No s'han trobat les capçaleres necessàries: 'Alumne', 'Curs', 'Tipus'.");
  }

  const cleanedData: Incident[] = [];
  const unknownTypesMap = new Map<string, number>();

  for (const row of rows) {
    // Check if the row is not empty and has enough columns
    if (row.length < headers.length || row.every(cell => cell === '')) continue; 

    const rawTipus = row[headerMap.tipus];
    if (!rawTipus) continue; 

    const tipus = getNormalizedIncidentType(rawTipus);
    if (!tipus || !OFFICIAL_INCIDENT_TYPES.includes(tipus)) {
      const currentCount = unknownTypesMap.get(rawTipus) || 0;
      unknownTypesMap.set(rawTipus, currentCount + 1);
      continue;
    }

    const rawAlumne = row[headerMap.alumne];
    const rawCurs = row[headerMap.curs];

    if (!rawAlumne || !rawCurs) continue; 

    const curs = getNormalizedCourse(rawCurs);
    if (!curs) continue;

    let quantitat = 1;
    const rawQuantitat = headerMap.quantitat !== undefined ? row[headerMap.quantitat] : null;
    const parsedQuantitat = rawQuantitat ? parseInt(rawQuantitat, 10) : NaN;

    if (!isNaN(parsedQuantitat) && parsedQuantitat > 0) {
      quantitat = parsedQuantitat;
    } else if (TYPES_REQUIRING_QUANTITY.includes(tipus)) {
      quantitat = 1; // Default to 1 if missing for specific types
    }

    cleanedData.push({
      alumne: rawAlumne, // The new parser handles quotes, so no .replace() is needed.
      curs,
      tipus,
      quantitat,
    });
  }

  const unknownTypes: UnknownTypeInfo[] = Array.from(unknownTypesMap.entries()).map(([value, count]) => ({ value, count }));

  return { cleanedData, unknownTypes };
};