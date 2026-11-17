import { useCallback, useState } from 'react';

export default function useAdminPagination(initialSize = 10) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(initialSize);
  const changeSize = useCallback(value => {
    setSize(value);
    setPage(0);
  }, []);
  return { page, size, onChange: setPage, onSizeChange: changeSize };
}
