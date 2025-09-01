import React from 'react';

export const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col items-center justify-center p-10">
    <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary"></div>
    <p className="mt-4 text-lg text-text-secondary font-semibold">Carregant dades...</p>
  </div>
);