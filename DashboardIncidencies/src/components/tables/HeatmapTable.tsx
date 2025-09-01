import React, { useMemo } from 'react';
import type { Incident } from '../../types';
import { IncidentType } from '../../types';

interface HeatmapTableProps {
  incidents: Incident[];
}

const getColorForValue = (value: number, max: number): React.CSSProperties => {
  if (value === 0 || max === 0) return { backgroundColor: 'transparent' };
  const intensity = Math.sqrt(value / max); // Use sqrt for better visual distribution
  const opacity = 0.1 + intensity * 0.9;
  return { backgroundColor: `rgba(249, 115, 22, ${opacity})` }; // Using orange-500 with variable opacity
};


export const HeatmapTable: React.FC<HeatmapTableProps> = ({ incidents }) => {
  const tableHeaders = ['Alumne', ...Object.values(IncidentType)];
  
  const { data: heatmapData, maxValue } = useMemo(() => {
    const studentData = new Map<string, { [key: string]: number | string }>();

    incidents.forEach(incident => {
      if (!studentData.has(incident.alumne)) {
        const initialRow: { [key:string]: number | string } = { Alumne: incident.alumne };
        Object.values(IncidentType).forEach(type => initialRow[type] = 0);
        studentData.set(incident.alumne, initialRow);
      }
      const studentRow = studentData.get(incident.alumne)!;
      studentRow[incident.tipus] = (studentRow[incident.tipus] as number) + incident.quantitat;
    });

    const dataArray = Array.from(studentData.values());
    dataArray.sort((a, b) => (a.Alumne as string).localeCompare(b.Alumne as string));
    
    let max = 0;
    dataArray.forEach(row => {
        Object.values(IncidentType).forEach(type => {
            if((row[type] as number) > max) {
                max = row[type] as number;
            }
        })
    });

    return { data: dataArray, maxValue: max };
  }, [incidents]);


  if (heatmapData.length === 0) {
    return <p className="text-text-secondary text-center py-4">No hi ha dades per mostrar el mapa de calor.</p>;
  }

  return (
    <div className="overflow-x-auto max-h-96">
      <table className="min-w-full text-base text-left text-text-primary border-collapse">
        <thead className="text-sm text-text-secondary uppercase bg-slate-100 backdrop-blur-sm sticky top-0">
          <tr>
            {tableHeaders.map(header => (
              <th 
                key={header} 
                scope="col" 
                className={`px-4 py-3 whitespace-nowrap ${header === 'Alumne' ? 'text-left' : 'text-center'}`}>
                  {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heatmapData.map((row, index) => (
            <tr key={index} className="bg-surface border-b border-border-color hover:bg-slate-50">
              {tableHeaders.map(header => {
                  const isNumericCell = header !== 'Alumne';
                  const value = row[header] as number;
                return (
                  <td 
                    key={header} 
                    style={isNumericCell ? getColorForValue(value, maxValue) : {}}
                    className={`px-4 py-3 transition-colors duration-300 ${isNumericCell ? 'text-center' : 'font-medium text-text-primary whitespace-nowrap text-left'}`}>
                    {value > 0 || !isNumericCell ? row[header] : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};