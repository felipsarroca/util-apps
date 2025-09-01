import React, { useMemo } from 'react';
import type { Incident, Filters } from '../../types';
import { IncidentType } from '../../types';

interface StudentSummaryTableProps {
  filteredIncidents: Incident[];
  allIncidents: Incident[];
  filters: Filters;
}

const exportToCSV = (headers: string[], data: (string | number)[][]) => {
  const csvContent = [
    headers.join(','),
    ...data.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.href) {
    URL.revokeObjectURL(link.href);
  }
  link.href = URL.createObjectURL(blob);
  link.download = `resum_incidencies_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const StudentSummaryTable: React.FC<StudentSummaryTableProps> = ({ filteredIncidents, allIncidents, filters }) => {
  const tableHeaders = ['Alumne', ...Object.values(IncidentType), 'Total'];
  
  const summaryData = useMemo(() => {
    // If a type filter is active, we want to show ALL incidents for the students who match the filter.
    // Otherwise, we just show the summary of the currently filtered incidents.
    const incidentsToSummarize = filters.tipus.length > 0 || filters.curs.length > 0 || filters.alumne.length > 0
      ? allIncidents.filter(i => 
          new Set(filteredIncidents.map(f => f.alumne)).has(i.alumne)
        )
      : filteredIncidents;

    const studentData = new Map<string, { [key: string]: number | string }>();

    incidentsToSummarize.forEach(incident => {
      if (!studentData.has(incident.alumne)) {
        const initialRow: { [key: string]: number | string } = { Alumne: incident.alumne, Total: 0 };
        Object.values(IncidentType).forEach(type => initialRow[type] = 0);
        studentData.set(incident.alumne, initialRow);
      }
      const studentRow = studentData.get(incident.alumne)!;
      studentRow[incident.tipus] = (studentRow[incident.tipus] as number) + incident.quantitat;
      studentRow.Total = (studentRow.Total as number) + incident.quantitat;
    });

    const dataArray = Array.from(studentData.values());

    // Sort based on the filtered type if only one is selected, or by the total otherwise.
    if (filters.tipus.length === 1) {
      const singleType = filters.tipus[0];
      dataArray.sort((a, b) => (b[singleType] as number) - (a[singleType] as number));
    } else {
      dataArray.sort((a, b) => (b.Total as number) - (a.Total as number));
    }
    
    return dataArray;
  }, [filteredIncidents, allIncidents, filters]);

  const handleExport = () => {
      const dataForCsv = summaryData.map(row => tableHeaders.map(header => row[header]));
      exportToCSV(tableHeaders, dataForCsv);
  }

  if (summaryData.length === 0) {
    return <p className="text-text-secondary text-center py-4">No hi ha dades per mostrar un resum.</p>;
  }
  
  const filteredTypes = new Set(filters.tipus);

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={handleExport}
          className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-all duration-200 transform hover:-translate-y-0.5"
        >
          Exporta a CSV
        </button>
      </div>
      <div className="overflow-x-auto max-h-96">
        <table className="min-w-full text-base text-left text-text-primary">
          <thead className="text-sm text-text-secondary uppercase bg-slate-100 backdrop-blur-sm sticky top-0">
            <tr>
              {tableHeaders.map(header => {
                const isFilteredColumn = filteredTypes.has(header as IncidentType);
                return (
                  <th 
                    key={header} 
                    scope="col" 
                    className={`px-4 py-3 transition-colors ${header === 'Alumne' ? 'text-left' : 'text-center'} ${isFilteredColumn ? 'bg-brand-secondary/20 text-orange-800 font-bold' : ''}`}>
                      {header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {summaryData.map((row, index) => (
              <tr key={index} className="bg-surface border-b border-border-color hover:bg-slate-50">
                {tableHeaders.map(header => {
                  const isFilteredColumn = filteredTypes.has(header as IncidentType);
                  return (
                    <td 
                      key={header} 
                      className={`px-4 py-3 transition-colors ${header === 'Alumne' ? 'font-medium text-text-primary whitespace-nowrap text-left' : 'text-center'} ${isFilteredColumn ? 'bg-orange-500/10 font-bold text-orange-700' : ''}`}>
                      {row[header]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};