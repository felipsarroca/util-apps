import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import type { Incident } from '../../types';

interface StudentRankingChartProps {
  incidents: Incident[];
}

export const StudentRankingChart: React.FC<StudentRankingChartProps> = ({ incidents }) => {
  const chartData = useMemo(() => {
    const studentTotals = incidents.reduce((acc, incident) => {
      acc[incident.alumne] = (acc[incident.alumne] || 0) + incident.quantitat;
      return acc;
    }, {} as { [key: string]: number });

    return Object.entries(studentTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total) // Sort descending
      .slice(0, 10);
  }, [incidents]);
  
  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-text-secondary">No hi ha dades per mostrar</div>;
  }

  return (
    <div style={{ width: '100%', height: 500 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 40, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" stroke="#64748b" fontSize={14} />
          <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={14} width={180} />
          <Tooltip 
            cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }}
            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}/>
          <Bar dataKey="total" fill="#f97316">
            <LabelList dataKey="total" position="right" style={{ fill: '#1e293b', fontSize: '14px' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};