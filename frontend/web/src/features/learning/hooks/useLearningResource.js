import { useEffect, useState } from 'react';

export default function useLearningResource(loader, fallback) {
  const [state, setState] = useState({
    data: fallback,
    error: null,
    loading: true,
    usingFallback: false,
  });

  useEffect(() => {
    let active = true;

    loader()
      .then(response => {
        if (!active) return;
        setState({
          data: response?.data ?? fallback,
          error: null,
          loading: false,
          usingFallback: false,
        });
      })
      .catch(error => {
        if (!active) return;
        setState({
          data: fallback,
          error,
          loading: false,
          usingFallback: true,
        });
      });

    return () => {
      active = false;
    };
  }, [loader, fallback]);

  return state;
}
