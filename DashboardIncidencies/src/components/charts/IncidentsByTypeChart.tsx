import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface IncidentsByTypeChartProps {
  data: { [key: string]: number };
}

const COLORS = ['#2563eb', '#f97316', '#10b981', '#f59e0b', '#0ea5e9', '#ef4444', '#8b5cf6'];

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: { cx: number; cy: number; midAngle?: number; innerRadius: number; outerRadius: number; percent?: number; value?: number; }) => {
  if (percent === undefined || percent < 0.05 || midAngle === undefined || value === undefined) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central" 
      className="text-base font-bold"
      paintOrder="stroke"
      stroke="#00000050"
      strokeWidth={2}
      strokeLinejoin="round"
    >
      {`${value} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};

export const IncidentsByTypeChart: React.FC<IncidentsByTypeChartProps> = ({ data }) => {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-text-secondary">No hi ha dades per mostrar</div>;
  }

  return (
    <div style={{ width: '100%', height: 350 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={130}
            innerRadius={80}
            fill="#8884d8"
            dataKey="value"
            stroke="#ffffff"
            strokeWidth={2}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
            cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }}/>
          <Legend iconSize={12} wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};