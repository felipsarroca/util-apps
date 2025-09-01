
import { StudentSummary, IncidentType } from '../types';

export function exportToCSV(data: StudentSummary[], officialTypes: IncidentType[]) {
  const headers = ['Alumne', ...officialTypes, 'Total'];
  const csvRows = [headers.join(',')];

  data.forEach(row => {
    const values = [
      `"${row.alumne}"`,
      ...officialTypes.map(type => row[type] || 0),
      row.total,
    ];
    csvRows.push(values.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', 'resum_incidencies.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Simple CSV parser that handles quoted fields
export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.split('\n');
  
  lines.forEach(line => {
    if (!line.trim()) return;
    const row: string[] = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentField.trim().replace(/^"|"$/g, ''));
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim().replace(/^"|"$/g, ''));
    rows.push(row);
  });
  
  return rows;
}
