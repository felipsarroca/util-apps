import { useState, useEffect } from 'react';

function getValueFromLocalStorage<T,>(key: string, initialValue: T): T {
  const savedValue = localStorage.getItem(key);
  if (savedValue) {
    try {
      return JSON.parse(savedValue) as T;
    } catch (error) {
      console.error('Error parsing localStorage key:', key, error);
      return initialValue;
    }
  }
  return initialValue;
}

export function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    return getValueFromLocalStorage(key, initialValue);
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error setting localStorage key:', key, error);
    }
  }, [key, value]);

  return [value, setValue];
}