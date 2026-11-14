import { useCallback, useEffect, useState } from 'react';
import { AUTH_CHANGED_EVENT } from '../../../shared/constants/appConstants';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';

export default function useLearningResource(loader, emptyData, revision = 0) {
  const sessionVersion = getSessionVersion();
  const [state, setState] = useState({
    data: emptyData,
    error: null,
    loading: true,
    usingFallback: false,
    sessionVersion,
  });

  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const isCurrent = () => active && sessionVersion === getSessionVersion();

    Promise.resolve()
      .then(() => {
        if (!isCurrent()) return undefined;

        setState({
          data: emptyData,
          error: null,
          loading: true,
          usingFallback: false,
          sessionVersion,
        });

        return loader({ signal: controller.signal });
      })
      .then(response => {
        if (!isCurrent()) return;

        setState({
          data: response?.data ?? emptyData,
          error: null,
          loading: false,
          usingFallback: false,
          sessionVersion,
        });
      })
      .catch(error => {
        if (!isCurrent()) return;

        setState({
          data: emptyData,
          error,
          loading: false,
          usingFallback: false,
          sessionVersion,
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [loader, emptyData, revision, attempt, sessionVersion]);

  useEffect(() => {
    window.addEventListener('focus', reload);
    const onAuthChanged = () => {
      if (getSessionVersion() !== sessionVersion) reload();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);

    return () => {
      window.removeEventListener('focus', reload);
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, [reload, sessionVersion]);

  const visible =
    state.sessionVersion === sessionVersion
      ? state
      : { data: emptyData, error: null, loading: true, usingFallback: false };
  return { ...visible, reload };
}
