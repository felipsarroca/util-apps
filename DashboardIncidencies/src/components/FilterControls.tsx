import React from 'react';
import type { Filters } from '../types';
import { IncidentType, Course } from '../types';
import { ArrowPathIcon, DocumentChartBarIcon, TrashIcon } from './shared/Icon';
import { MultiSelectDropdown } from './shared/MultiSelectDropdown';

interface FilterControlsProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  uniqueStudents: string[];
  onClearUrl: () => void;
  onRefresh: () => void;
}

const FilterChip: React.FC<{ value: string; onClear: () => void }> = ({ value, onClear }) => (
  <div className="flex items-center bg-brand-primary text-white text-sm font-semibold px-3 py-1 rounded-full">
    <span>{value}</span>
    <button onClick={onClear} className="ml-2 -mr-1 text-blue-200 hover:text-white text-lg leading-none">&times;</button>
  </div>
);

export const FilterControls: React.FC<FilterControlsProps> = ({ filters, setFilters, uniqueStudents, onClearUrl, onRefresh }) => {
  const handleFilterChange = <K extends keyof Filters,>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const handleChipClear = <K extends keyof Filters,>(key: K, valueToRemove: string) => {
    const currentValues = filters[key] as string[];
    handleFilterChange(key, currentValues.filter(v => v !== valueToRemove) as Filters[K]);
  }

  const clearFilters = () => {
    setFilters({ curs: [], tipus: [], alumne: [] });
  };
  
  const activeFiltersCount = filters.curs.length + filters.tipus.length + filters.alumne.length;

  return (
    <div className="p-4 bg-surface rounded-xl shadow-md border border-border-color mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MultiSelectDropdown
              options={Object.values(Course)}
              selectedOptions={filters.curs}
              onChange={(selected) => handleFilterChange('curs', selected as Course[])}
              placeholder="Filtra per Curs..."
            />
            <MultiSelectDropdown
              options={Object.values(IncidentType)}
              selectedOptions={filters.tipus}
              onChange={(selected) => handleFilterChange('tipus', selected as IncidentType[])}
              placeholder="Filtra per Tipus..."
            />
            <MultiSelectDropdown
              options={uniqueStudents}
              selectedOptions={filters.alumne}
              onChange={(selected) => handleFilterChange('alumne', selected)}
              placeholder="Filtra per Alumne..."
            />
        </div>
        
        {activeFiltersCount > 0 && (
          <div className="mt-4 pt-4 border-t border-border-color">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-semibold text-text-secondary">Filtres actius:</span>
                    {filters.curs.map(c => <FilterChip key={`c-${c}`} value={c} onClear={() => handleChipClear('curs', c)} />)}
                    {filters.tipus.map(t => <FilterChip key={`t-${t}`} value={t} onClear={() => handleChipClear('tipus', t)} />)}
                    {filters.alumne.map(a => <FilterChip key={`a-${a}`} value={a} onClear={() => handleChipClear('alumne', a)} />)}
                    
                    <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-brand-primary hover:text-blue-700 font-semibold transition ml-2">
                       <TrashIcon className="h-4 w-4" /> Neteja Tots
                    </button>
                </div>
            </div>
          </div>
        )}
        
         <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
             <button onClick={onRefresh} className="flex items-center justify-center gap-2 bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg shadow-sm hover:bg-slate-300 transition-all duration-200 transform hover:-translate-y-0.5">
                <ArrowPathIcon className="h-5 w-5"/> Refresca
            </button>
            <button onClick={onClearUrl} className="flex items-center justify-center gap-2 bg-brand-red text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-red-600 transition-all duration-200 transform hover:-translate-y-0.5">
                <DocumentChartBarIcon className="h-5 w-5"/> Canvia Full
            </button>
        </div>
    </div>
  );
};