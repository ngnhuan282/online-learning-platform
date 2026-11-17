import { createContext, useCallback, useEffect, useMemo } from 'react';
import useAuth from '../../auth/hooks/useAuth';
import useLearningResource from '../../learning/hooks/useLearningResource';
import { proApi, PRO_CHANGED } from '../api/proApi';

// eslint-disable-next-line react-refresh/only-export-components
export const ProContext = createContext(null);
export function ProProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const load = useCallback(
    options => (userId == null ? Promise.resolve({ data: null }) : proApi.membership(options)),
    [userId],
  );
  const resource = useLearningResource(load, null);
  const { reload } = resource;
  useEffect(() => {
    if (userId == null) return undefined;
    window.addEventListener(PRO_CHANGED, reload);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') reload();
    }, 60000);
    return () => {
      window.removeEventListener(PRO_CHANGED, reload);
      window.clearInterval(timer);
    };
  }, [reload, userId]);
  const membership = userId != null && resource.data?.userId === userId ? resource.data : null;
  const value = useMemo(
    () => ({ membership, loading: resource.loading, error: resource.error, refresh: reload }),
    [membership, resource.loading, resource.error, reload],
  );
  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}
