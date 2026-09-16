import { useEffect, useState } from 'react';
export default function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
