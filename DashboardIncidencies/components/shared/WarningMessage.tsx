import React, { useState } from 'react';
import type { UnknownTypeInfo } from '../../types';
import { InformationCircleIcon } from './Icon';

interface WarningMessageProps {
  unknownTypes: UnknownTypeInfo[];
}

export const WarningMessage: React.FC<WarningMessageProps> = ({ unknownTypes }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || unknownTypes.length === 0) {
    return null;
  }

  const totalDiscarded = unknownTypes.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded-r-lg shadow-md relative" role="alert">
      <div className="flex items-start">
        <InformationCircleIcon className="h-6 w-6 text-amber-500 mr-3 mt-1" />
        <div>
          <p className="font-bold">Avís de Dades</p>
          <p className="text-sm mt-1">
            S'han descartat {totalDiscarded} files perquè contenen Tipus d'incidència desconeguts. 
            Si us plau, corregeix-los al Google Sheet per incloure'ls a l'anàlisi.
          </p>
          <ul className="list-disc list-inside text-xs mt-2 space-y-1">
            {unknownTypes.map(t => (
              <li key={t.value}>
                <span className="font-semibold">"{t.value}"</span> ({t.count} vegades)
              </li>
            ))}
          </ul>
        </div>
      </div>
      <button 
        onClick={() => setIsVisible(false)} 
        className="absolute top-2 right-2 text-amber-600 hover:text-amber-800"
        aria-label="Tanca avís"
      >
        &#x2715;
      </button>
    </div>
  );
};