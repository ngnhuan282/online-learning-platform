import { createContext, useCallback, useEffect, useMemo } from 'react';
import useAuth from '../../auth/hooks/useAuth';
import useNotifications from '../../learning/hooks/useNotifications';
import useLearningResource from '../../learning/hooks/useLearningResource';
import { engagementApi } from '../api/engagementApi';
import { ENGAGEMENT_CHANGED } from '../utils/engagementEvents';

// eslint-disable-next-line react-refresh/only-export-components
export const EngagementContext = createContext(null);
export function EngagementProvider({ children }) {
  const { user } = useAuth();
  const notifications = useNotifications();
  const userId = user?.id;
  const load = useCallback(
    options => (userId == null ? Promise.resolve({ data: null }) : engagementApi.summary(options)),
    [userId],
  );
  const resource = useLearningResource(load, null, notifications?.revision || 0);
  const { reload } = resource;
  useEffect(() => {
    if (userId == null) return undefined;
    window.addEventListener(ENGAGEMENT_CHANGED, reload);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') reload();
    }, 60000);
    return () => {
      window.removeEventListener(ENGAGEMENT_CHANGED, reload);
      window.clearInterval(timer);
    };
  }, [reload, userId]);
  const summary = userId != null && resource.data?.userId === userId ? resource.data : null;
  const value = useMemo(
    () => ({ summary, loading: resource.loading, error: resource.error, refresh: reload }),
    [summary, resource.loading, resource.error, reload],
  );
  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}
