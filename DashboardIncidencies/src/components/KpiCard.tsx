import React from 'react';

export interface KpiData {
  totalIncidents: number;
  affectedStudents: number;
  avgPerStudent: string;
  top3Types: { name: string; value: number }[];
  incidentsByType: { [key: string]: number };
}

interface KpiCardProps {
  icon?: React.ReactNode;
  title: string;
  value: string;
  children?: React.ReactNode;
}

export const KpiCard: React.FC<KpiCardProps> = ({ icon, title, value, children }) => {
  return (
    <div className="bg-surface p-6 rounded-2xl shadow-md border border-border-color flex flex-col justify-between transform hover:scale-105 transition-transform duration-300 hover:shadow-xl hover:bg-slate-50">
      <div>
        <div className="flex items-center gap-3">
          {icon && <div className="text-brand-primary">{icon}</div>}
          <h4 className="font-semibold text-text-secondary uppercase tracking-wider">{title}</h4>
        </div>
        {value && <p className="text-5xl font-bold text-text-primary mt-2">{value}</p>}
        {children}
      </div>
    </div>
  );
};