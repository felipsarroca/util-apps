import React, { useState, useMemo } from 'react';
import { Incident, Curs, IncidentType, StudentSummary, DataWarning } from '../types';
import { OFFICIAL_TYPES, OFFICIAL_CURSOS } from '../constants';
import { exportToCSV } from '../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts';
import { WarningIcon, ChartBarIcon, UsersIcon, TableIcon, CloseIcon, TotalIncidentsIcon, TopTypeIcon, AverageIcon } from './common/Icons';

interface DashboardProps {
  data: Incident[];
  warnings: DataWarning[];
  onReset: () => void;
}

const COLORS = ['#4f46e5', '#f97316', '#10b981', '#ec4899', '#3b82f6', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#22c55e'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/80 backdrop-blur-sm p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="label text-gray-900 font-bold">{`${label}`}</p>
        {payload.map((p: any, index: number) => (
            <p key={index} style={{ color: p.color }} className="font-medium">{`${p.name}: ${p.value}`}</p>
        ))}
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ data, warnings, onReset }) => {
  const [filters, setFilters] = useState<{ curs: Curs | null; tipus: IncidentType | null; alumne: string | null }>({
    curs: null,
    tipus: null,
    alumne: null,
  });

  const uniqueAlumnes = useMemo(() => [...new Set(data.map(d => d.alumne))].sort(), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      return (
        (!filters.curs || item.curs === filters.curs) &&
        (!filters.tipus || item.tipus === filters.tipus) &&
        (!filters.alumne || item.alumne === filters.alumne)
      );
    });
  }, [data, filters]);

  const resetFilters = () => setFilters({ curs: null, tipus: null, alumne: null });

  const kpis = useMemo(() => {
    const totalIncidents = filteredData.reduce((acc, item) => acc + item.quantitat, 0);
    const affectedStudents = new Set(filteredData.map(d => d.alumne)).size;
    const avgPerStudent = affectedStudents > 0 ? (totalIncidents / affectedStudents).toFixed(2) : 0;
    
    const byType = OFFICIAL_TYPES.map(type => ({
        name: type,
        value: filteredData.filter(d => d.tipus === type).reduce((sum, d) => sum + d.quantitat, 0)
    })).sort((a,b) => b.value - a.value);

    return { totalIncidents, affectedStudents, avgPerStudent, byType };
  }, [filteredData]);

  const dataByType = kpis.byType.filter(item => item.value > 0);

  const dataByCourse = useMemo(() => {
    return OFFICIAL_CURSOS.map(curs => ({
      name: curs,
      [filters.tipus || 'Total']: filteredData
        .filter(d => d.curs === curs)
        .reduce((sum, d) => sum + d.quantitat, 0),
    }));
  }, [filteredData, filters.tipus]);

  const studentRanking = useMemo(() => {
    const ranking: { [key: string]: number } = {};
    filteredData.forEach(d => {
      ranking[d.alumne] = (ranking[d.alumne] || 0) + d.quantitat;
    });
    return Object.entries(ranking)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [filteredData]);
  
  const studentSummary: StudentSummary[] = useMemo(() => {
    // 1. Filter data for the table (ignore 'tipus' filter for data aggregation)
    const tableData = data.filter(item => {
      return (
        (!filters.curs || item.curs === filters.curs) &&
        (!filters.alumne || item.alumne === filters.alumne)
      );
    });

    // 2. Aggregate the filtered data
    const summary: { [key: string]: StudentSummary } = {};
    tableData.forEach(d => {
        if (!summary[d.alumne]) {
            summary[d.alumne] = { alumne: d.alumne, total: 0 };
        }
        summary[d.alumne][d.tipus] = (summary[d.alumne][d.tipus] || 0) + d.quantitat;
        summary[d.alumne].total += d.quantitat;
    });
    
    // 3. Sort the aggregated data based on the 'tipus' filter or total
    const sortedValues = Object.values(summary).sort((a, b) => {
        if (filters.tipus) {
            const valA = a[filters.tipus] || 0;
            const valB = b[filters.tipus] || 0;
            if (valB !== valA) {
                return valB - valA; // Sort by selected type
            }
        }
        return b.total - a.total; // Fallback/default sort by total
    });
    return sortedValues;
  }, [data, filters.curs, filters.alumne, filters.tipus]);


  const renderFilterChip = (key: 'curs' | 'tipus' | 'alumne', value: string | null) => {
    if (!value) return null;
    return (
        <span className="flex items-center bg-indigo-500 text-white text-xs font-semibold mr-2 px-3 py-1 rounded-full shadow">
            {value}
            <button onClick={() => setFilters(f => ({...f, [key]: null}))} className="ml-1.5 p-0.5 rounded-full hover:bg-white/20 transition-colors">
                <CloseIcon />
            </button>
        </span>
    );
  };
  
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap justify-between items-center p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard d'incidències</h1>
        <button onClick={onReset} className="text-sm bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors border border-gray-300 shadow-sm hover:shadow-md">Canvia el full</button>
      </header>
      
      <main className="p-4 sm:p-6 lg:p-8 pt-0">
        {warnings.map((w, i) => (
            <div key={i} className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-lg relative mb-6 flex items-start shadow" role="alert">
                <WarningIcon />
                <span className="block sm:inline">{w.message}</span>
            </div>
        ))}
        
        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl mb-6 shadow-lg border border-gray-200 sticky top-4 z-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select value={filters.curs || ''} onChange={e => setFilters({...filters, curs: e.target.value as Curs || null})} className="w-full bg-gray-100 border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner">
                    <option value="">Tots els cursos</option>
                    {OFFICIAL_CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filters.tipus || ''} onChange={e => setFilters({...filters, tipus: e.target.value as IncidentType || null})} className="w-full bg-gray-100 border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner">
                    <option value="">Tots els tipus</option>
                    {OFFICIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filters.alumne || ''} onChange={e => setFilters({...filters, alumne: e.target.value || null})} className="w-full bg-gray-100 border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner">
                    <option value="">Tots els alumnes</option>
                    {uniqueAlumnes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
            <div className="mt-4 flex items-center flex-wrap min-h-[28px]">
                {renderFilterChip('curs', filters.curs)}
                {renderFilterChip('tipus', filters.tipus)}
                {renderFilterChip('alumne', filters.alumne)}
                {(filters.curs || filters.tipus || filters.alumne) && (
                    <button onClick={resetFilters} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">Neteja filtres</button>
                )}
            </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-2xl shadow-lg text-white flex justify-between items-center">
                <div>
                    <h3 className="text-sm font-medium text-indigo-100">Total d'incidències</h3>
                    <p className="mt-1 text-3xl font-semibold">{kpis.totalIncidents}</p>
                </div>
                <TotalIncidentsIcon className="h-10 w-10 text-white/50" />
            </div>
            <div className="bg-gradient-to-br from-orange-400 to-red-500 p-5 rounded-2xl shadow-lg text-white flex justify-between items-center">
                <div>
                    <h3 className="text-sm font-medium text-orange-100">Alumnes afectats</h3>
                    <p className="mt-1 text-3xl font-semibold">{kpis.affectedStudents}</p>
                </div>
                <UsersIcon className="h-10 w-10 text-white/50" />
            </div>
            <div className="bg-gradient-to-br from-green-400 to-teal-500 p-5 rounded-2xl shadow-lg text-white flex justify-between items-center">
                <div>
                    <h3 className="text-sm font-medium text-green-100">Mitjana per alumne</h3>
                    <p className="mt-1 text-3xl font-semibold">{kpis.avgPerStudent}</p>
                </div>
                <AverageIcon className="h-10 w-10 text-white/50" />
            </div>
            <div className="bg-gradient-to-br from-pink-500 to-rose-500 p-5 rounded-2xl shadow-lg text-white flex justify-between items-center">
                <div>
                    <h3 className="text-sm font-medium text-pink-100">Tipus més freqüent</h3>
                    <p className="mt-1 text-xl font-semibold truncate" title={kpis.byType[0]?.name || 'N/A'}>{kpis.byType[0]?.name || 'N/A'}</p>
                </div>
                <TopTypeIcon className="h-10 w-10 text-white/50" />
            </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200 border-t-4 border-indigo-400 h-96">
                <h3 className="font-semibold text-indigo-800 flex items-center mb-4"><ChartBarIcon/>Distribució per tipus</h3>
                <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                        <Pie data={dataByType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                            {dataByType.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200 border-t-4 border-indigo-400 h-96">
                <h3 className="font-semibold text-indigo-800 flex items-center mb-4"><ChartBarIcon/>Comparativa per curs</h3>
                <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={dataByCourse} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" stroke="#6b7280" />
                        <YAxis stroke="#6b7280" />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(79, 70, 229, 0.05)'}} />
                        <Legend />
                        <Bar dataKey={filters.tipus || 'Total'} fill="#4f46e5" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200 border-t-4 border-indigo-400 h-[700px] lg:col-span-2">
                <h3 className="font-semibold text-indigo-800 flex items-center mb-4"><UsersIcon className="h-5 w-5 mr-2" />Rànquing d'alumnes (Top 20)</h3>
                <ResponsiveContainer width="100%" height="95%">
                    <BarChart data={studentRanking} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" stroke="#6b7280" />
                        <YAxis type="category" dataKey="name" stroke="#6b7280" width={150} interval={0} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(79, 70, 229, 0.05)'}} />
                        <Legend />
                        <Bar dataKey="value" name="Total Incidències">
                            {studentRanking.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
        
        {/* Student Summary Table */}
        <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200 border-t-4 border-indigo-400">
            <div className="flex flex-wrap justify-between items-center mb-4">
                <h3 className="font-semibold text-indigo-800 flex items-center"><TableIcon />Agrupació per alumne</h3>
                <button onClick={() => exportToCSV(studentSummary, OFFICIAL_TYPES)} className="text-sm bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm hover:shadow-md">
                    Exporta a CSV
                </button>
            </div>
            <div className="overflow-x-auto max-h-[600px] rounded-lg border">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
                        <tr>
                            <th scope="col" className="px-6 py-3 min-w-[200px]">Alumne</th>
                            {OFFICIAL_TYPES.map(type => (
                                <th key={type} scope="col" className={`px-6 py-3 text-center transition-all duration-200 ${filters.tipus === type ? 'text-indigo-600' : ''}`}>{type}</th>
                            ))}
                            <th scope="col" className="px-6 py-3 text-center font-bold">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {studentSummary.map((student) => (
                            <tr key={student.alumne} className="bg-white border-b hover:bg-gray-50">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                    {student.alumne}
                                </th>
                                {OFFICIAL_TYPES.map(type => (
                                    <td key={type} className={`px-6 py-4 text-center transition-all duration-200 ${filters.tipus === type ? 'font-bold text-lg text-indigo-600' : 'text-gray-700'}`}>
                                        {student[type] || 0}
                                    </td>
                                ))}
                                <td className="px-6 py-4 text-center font-bold text-gray-900">{student.total}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;