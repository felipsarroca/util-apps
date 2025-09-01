import React, { useMemo } from 'react';
import type { Incident, Filters, UnknownTypeInfo, Course } from '../types';
import { FilterControls } from './FilterControls';
import { WarningMessage } from './shared/WarningMessage';
import { KpiCard, KpiData } from './KpiCard';
import { IncidentsByTypeChart } from './charts/IncidentsByTypeChart';
import { IncidentsByCourseChart } from './charts/IncidentsByCourseChart';
import { StudentRankingChart } from './charts/StudentRankingChart';
import { StudentSummaryTable } from './tables/StudentSummaryTable';
import { HeatmapTable } from './tables/HeatmapTable';
import { ChartPieIcon, TableCellsIcon, UserGroupIcon, ExclamationTriangleIcon, FireIcon } from './shared/Icon';

interface DashboardProps {
  allIncidents: Incident[];
  filteredIncidents: Incident[];
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  unknownTypes: UnknownTypeInfo[];
  uniqueStudents: string[];
  onClearUrl: () => void;
  onRefresh: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  allIncidents,
  filteredIncidents,
  filters,
  setFilters,
  unknownTypes,
  uniqueStudents,
  onClearUrl,
  onRefresh,
}) => {
  const kpiData = useMemo<KpiData>(() => {
    const totalIncidents = filteredIncidents.reduce((sum, i) => sum + i.quantitat, 0);
    const affectedStudents = new Set(filteredIncidents.map(i => i.alumne)).size;
    const avgPerStudent = affectedStudents > 0 ? (totalIncidents / affectedStudents).toFixed(1) : '0';

    const incidentsByType = filteredIncidents.reduce((acc, i) => {
      acc[i.tipus] = (acc[i.tipus] || 0) + i.quantitat;
      return acc;
    }, {} as { [key: string]: number });
    
    const top3Types = Object.entries(incidentsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, value]) => ({ name, value }));

    return { totalIncidents, affectedStudents, avgPerStudent, top3Types, incidentsByType };
  }, [filteredIncidents]);

  return (
    <div className="space-y-8">
      {unknownTypes.length > 0 && <WarningMessage unknownTypes={unknownTypes} />}
      
      <FilterControls 
        filters={filters} 
        setFilters={setFilters} 
        uniqueStudents={uniqueStudents}
        onClearUrl={onClearUrl}
        onRefresh={onRefresh}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard icon={<ExclamationTriangleIcon />} title="Total incidències" value={kpiData.totalIncidents.toString()} />
        <KpiCard icon={<UserGroupIcon />} title="Alumnes afectats" value={kpiData.affectedStudents.toString()} />
        <KpiCard icon={<ChartPieIcon />} title="Mitjana / alumne" value={kpiData.avgPerStudent} />
        <KpiCard title="Top 3 tipus" value="">
          <ul className="space-y-1 text-lg mt-1">
            {kpiData.top3Types.map(t => <li key={t.name} className="flex justify-between"><span>{t.name}</span> <span className="font-bold text-brand-secondary">{t.value}</span></li>)}
             {kpiData.top3Types.length === 0 && <span className="text-text-secondary">No hi ha dades</span>}
          </ul>
        </KpiCard>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 p-6 bg-surface rounded-2xl shadow-md border border-border-color">
           <h3 className="text-xl font-semibold text-text-primary mb-4">Distribució per tipus</h3>
           <IncidentsByTypeChart data={kpiData.incidentsByType} />
        </div>
        <div className="lg:col-span-3 p-6 bg-surface rounded-2xl shadow-md border border-border-color">
          <h3 className="text-xl font-semibold text-text-primary mb-4">Comparativa per curs</h3>
          <IncidentsByCourseChart allIncidents={allIncidents} selectedTypes={filters.tipus} />
        </div>
      </div>
       <div className="p-6 bg-surface rounded-2xl shadow-md border border-border-color">
          <h3 className="text-xl font-semibold text-text-primary mb-4">Ranking d'alumnes (Top 10)</h3>
          <StudentRankingChart incidents={filteredIncidents} />
        </div>


      {/* Tables */}
      <div className="p-6 bg-surface rounded-2xl shadow-md border border-border-color">
         <div className="flex items-center gap-3 mb-4">
            <UserGroupIcon className="h-7 w-7 text-brand-primary"/>
            <h3 className="text-xl font-semibold text-text-primary">Resum per alumne</h3>
        </div>
        <StudentSummaryTable 
            filteredIncidents={filteredIncidents} 
            allIncidents={allIncidents}
            filters={filters} 
        />
      </div>

       <div className="p-6 bg-surface rounded-2xl shadow-md border border-border-color">
         <div className="flex items-center gap-3 mb-4">
            <FireIcon className="h-7 w-7 text-brand-secondary"/>
            <h3 className="text-xl font-semibold text-text-primary">Mapa de calor d'incidències</h3>
         </div>
        <HeatmapTable incidents={filteredIncidents} />
      </div>
    </div>
  );
};