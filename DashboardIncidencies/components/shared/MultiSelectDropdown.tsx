import React, { useState, useRef, useEffect } from 'react';

interface MultiSelectDropdownProps {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ options, selectedOptions, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelect = (option: string) => {
    if (selectedOptions.includes(option)) {
      onChange(selectedOptions.filter(o => o !== option));
    } else {
      onChange([...selectedOptions, option]);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-slate-300 rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary text-left flex justify-between items-center"
      >
        <span className="truncate">
            {selectedOptions.length > 0 ? selectedOptions.join(', ') : placeholder}
        </span>
        <svg className={`w-5 h-5 ml-2 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-auto">
          <ul className="py-1">
            {options.map(option => (
              <li
                key={option}
                onClick={() => handleSelect(option)}
                className="px-3 py-2 cursor-pointer hover:bg-slate-100 flex items-center"
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option)}
                  readOnly
                  className="mr-3 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                />
                <span>{option}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
