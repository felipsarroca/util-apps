import React from 'react';
import { ExclamationCircleIcon, ArrowPathIcon } from './Icon';

interface ErrorMessageProps {
  message: string;
  onRetry: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => (
  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-r-lg shadow-md" role="alert">
    <div className="flex items-center">
      <ExclamationCircleIcon className="h-8 w-8 text-red-500 mr-4" />
      <div>
        <p className="font-bold text-lg">Error de càrrega</p>
        <p className="text-sm mt-1">{message}</p>
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          <ArrowPathIcon className="h-5 w-5" />
          Torna a intentar-ho
        </button>
      </div>
    </div>
  </div>
);