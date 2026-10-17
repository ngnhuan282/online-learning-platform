import { useCallback, useEffect, useState } from 'react';

export default function useLearningResource(loader, emptyData, revision = 0) {
  const [state, setState] = useState({
    data: emptyData,
    error: null,
    loading: true,
    usingFallback: false,
  });

  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    Promise.resolve()
      .then(() => {
        if (!active) return undefined;

        setState({
          data: emptyData,
          error: null,
          loading: true,
          usingFallback: false,
        });

        return loader({ signal: controller.signal });
      })
      .then(response => {
        if (!active) return;

        setState({
          data: response?.data ?? emptyData,
          error: null,
          loading: false,
          usingFallback: false,
        });
      })
      .catch(error => {
        if (!active) return;

        setState({
          data: emptyData,
          error,
          loading: false,
          usingFallback: false,
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [loader, emptyData, revision, attempt]);

  useEffect(() => {
    window.addEventListener('focus', reload);

    return () => {
      window.removeEventListener('focus', reload);
    };
  }, [reload]);

  return { ...state, reload };
}