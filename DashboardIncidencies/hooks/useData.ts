
import { useState, useEffect, useCallback } from 'react';
import { Incident, DataWarning, RawIncidentData, Curs, IncidentType } from '../types';
import { CURS_NORMALIZATION_MAP, TIPUS_NORMALIZATION_MAP, OFFICIAL_TYPES, TYPES_DEFAULT_QUANTITY_1 } from '../constants';
import { parseCSV } from '../utils/helpers';

const SHEET_NAME = 'Buidat';

function transformUrl(url: string): string | null {
  const regex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const match = url.match(regex);
  if (!match) return null;
  const sheetId = match[1];
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;
}

export function useData(sheetUrl: string | null) {
  const [data, setData] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<DataWarning[]>([]);

  const processData = useCallback((csvText: string) => {
    const parsedRows = parseCSV(csvText);
    if (parsedRows.length < 2) {
      throw new Error("El full de càlcul sembla buit o té un format incorrecte.");
    }
    
    const headers = parsedRows[0].map(h => h.toLowerCase().trim());
    const requiredHeaders = ['alumne', 'curs', 'tipus', 'quantitat'];
    const headerIndices: { [key: string]: number } = {};
    
    requiredHeaders.forEach(rh => {
        const index = headers.findIndex(h => h.includes(rh));
        if(index === -1) throw new Error(`La columna necessària "${rh}" no s'ha trobat.`);
        headerIndices[rh] = index;
    });

    const incidents: Incident[] = [];
    const newWarnings: { [key: string]: DataWarning } = {};
    const unknownTypeCounts: { [key: string]: number } = {};

    for (let i = 1; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const raw: Partial<RawIncidentData> = {
            Alumne: row[headerIndices.alumne],
            Curs: row[headerIndices.curs],
            Tipus: row[headerIndices.tipus],
            Quantitat: row[headerIndices.quantitat],
        };

        if (!raw.Tipus || !raw.Alumne || !raw.Curs) continue;

        const normalizedTipusStr = raw.Tipus.toLowerCase().trim();
        const normalizedTipus = TIPUS_NORMALIZATION_MAP[normalizedTipusStr];

        if (!normalizedTipus) {
            unknownTypeCounts[raw.Tipus] = (unknownTypeCounts[raw.Tipus] || 0) + 1;
            continue;
        }
        
        const normalizedCursStr = raw.Curs.toLowerCase().trim();
        const normalizedCurs = CURS_NORMALIZATION_MAP[normalizedCursStr];

        if (!normalizedCurs) continue;

        let quantitat = parseInt(raw.Quantitat || '', 10);
        if (isNaN(quantitat)) {
            if (TYPES_DEFAULT_QUANTITY_1.includes(normalizedTipus)) {
                quantitat = 1;
                if (!newWarnings['missing_quantity']) {
                    newWarnings['missing_quantity'] = { type: 'missing_quantity', message: "Files amb 'Quantitat' buida s'han assumit com a 1.", count: 0 };
                }
                newWarnings['missing_quantity'].count++;
            } else {
                quantitat = 1; // Default to 1 for others as per spec
            }
        }
        
        if (quantitat > 0) {
            incidents.push({
                id: `${i}-${raw.Alumne}`,
                alumne: raw.Alumne.trim(),
                curs: normalizedCurs,
                tipus: normalizedTipus,
                quantitat,
            });
        }
    }

    if (Object.keys(unknownTypeCounts).length > 0) {
        const unknownMessages = Object.entries(unknownTypeCounts).map(([type, count]) => `"${type}" (${count})`).join(', ');
        const totalUnknown = Object.values(unknownTypeCounts).reduce((a, b) => a + b, 0);
        newWarnings['unknown_type'] = {
            type: 'unknown_type',
            message: `S'han descartat ${totalUnknown} files amb tipus desconeguts: ${unknownMessages}. Si us plau, corregeix-los a Google Sheets.`,
            count: totalUnknown
        };
    }

    setData(incidents);
    setWarnings(Object.values(newWarnings));
  }, []);
  
  useEffect(() => {
    if (!sheetUrl) {
      setData([]);
      setError(null);
      setWarnings([]);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setWarnings([]);
      const gvizUrl = transformUrl(sheetUrl);

      if (!gvizUrl) {
        setError("L'URL de Google Sheets no és vàlid.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(gvizUrl);
        if (!response.ok) {
            throw new Error(`Error d'accés (${response.status}). Assegura't que la pestanya "Buidat" del full de càlcul és pública o compartida amb "qualsevol persona amb l'enllaç".`);
        }
        const csvText = await response.text();
        processData(csvText);
      } catch (err: any) {
        setError(err.message || 'Hi ha hagut un problema en carregar les dades.');
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetUrl, processData]);

  return { data, isLoading, error, warnings };
}
