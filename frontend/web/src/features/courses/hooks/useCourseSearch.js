import { useState, useEffect } from 'react';

/**
 * useCourseSearch — Custom hook debounce tìm kiếm khóa học (mặc định 300ms).
 * Giúp tránh spam API request khi người dùng đang gõ phím.
 */
export function useCourseSearch(initialKeyword = '', delay = 300) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [debouncedKeyword, setDebouncedKeyword] = useState(initialKeyword);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
    }, delay);

    return () => clearTimeout(timer);
  }, [keyword, delay]);

  return { keyword, setKeyword, debouncedKeyword };
}

export default useCourseSearch;
