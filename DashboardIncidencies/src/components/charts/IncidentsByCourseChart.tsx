import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import type { Incident, IncidentType } from '../../types';
import { Course } from '../../types';

interface IncidentsByCourseChartProps {
  allIncidents: Incident[];
  selectedTypes: IncidentType[];
}

export const IncidentsByCourseChart: React.FC<IncidentsByCourseChartProps> = ({ allIncidents, selectedTypes }) => {
  const chartData = useMemo(() => {
    const dataToFilter = selectedTypes.length > 0
      ? allIncidents.filter(i => selectedTypes.includes(i.tipus))
      : allIncidents;

    const courseCounts = dataToFilter.reduce((acc, incident) => {
      acc[incident.curs] = (acc[incident.curs] || 0) + incident.quantitat;
      return acc;
    }, {} as { [key in Course]?: number });

    return Object.values(Course).map(course => ({
      name: course,
      value: courseCounts[course] || 0,
    }));
  }, [allIncidents, selectedTypes]);

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 30, right: 10, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" stroke="#64748b" fontSize={14} />
          <YAxis stroke="#64748b" fontSize={14} />
          <Tooltip 
            cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }}
            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}/>
          <Bar dataKey="value" fill="#2563eb">
             <LabelList dataKey="value" position="top" style={{ fill: '#1e293b', fontSize: '14px' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};