import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useAuth from '../../auth/hooks/useAuth';
import { learningApi } from '../api/learningApi';
import { consumeNotificationStream } from '../utils/notificationStream';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';

const emptySummary = Object.freeze({ unreadCount: null, notifications: [] });
const initialState = { userId: null, summary: emptySummary, loading: false, error: null };

// eslint-disable-next-line react-refresh/only-export-components
export const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user, isLoggingOut } = useAuth();
  const userId = !isLoggingOut ? (user?.id ?? null) : null;
  const [state, setState] = useState(initialState);
  const [revision, setRevision] = useState(0);
  const reload = useRef(() => {});
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    if (userId == null) {
      reload.current = () => {};
      Promise.resolve().then(() => {
        if (current !== generation.current) return;
        setState(initialState);
        setRevision(0);
      });
      return undefined;
    }
    const controller = new AbortController();
    const version = getSessionVersion();
    let debounce;
    let reconnect;
    let loading = false;
    let dirty = false;
    let backoff = 1000;
    const active = () =>
      !controller.signal.aborted && version === getSessionVersion() && current === generation.current;

    async function loadSummary() {
      if (!active()) return;
      if (loading) {
        dirty = true;
        return;
      }
      loading = true;
      setState(previous => ({
        userId,
        summary: previous.userId === userId ? previous.summary : emptySummary,
        error: null,
        loading: true,
      }));
      try {
        const { data } = await learningApi.getNotificationSummary({ signal: controller.signal });
        if (!active()) return;
        setState({ userId, summary: data, loading: false, error: null });
        setRevision(value => value + 1);
      } catch (error) {
        if (!active()) return;
        setState(previous => ({ ...previous, loading: false, error }));
      } finally {
        loading = false;
        if (dirty && active()) {
          dirty = false;
          scheduleRefresh();
        }
      }
    }
    function scheduleRefresh() {
      if (!active()) return;
      clearTimeout(debounce);
      debounce = setTimeout(loadSummary, 100);
    }
    function scheduleReconnect() {
      if (!active()) return;
      reconnect = setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30000);
    }
    async function connect() {
      if (!active()) return;
      try {
        const stream = await learningApi.openNotificationStream({ signal: controller.signal });
        if (!active()) {
          await stream.cancel().catch(() => {});
          return;
        }
        await consumeNotificationStream(
          stream,
          ({ event }) => {
            if (!active()) return;
            if (event === 'connected') backoff = 1000;
            if (event === 'connected' || event === 'notifications-changed') scheduleRefresh();
          },
          controller.signal,
        );
      } catch (error) {
        if (active() && error.code !== 'ERR_CANCELED') {
          setState(previous => (previous.userId === userId ? { ...previous, error } : previous));
        }
      } finally {
        scheduleReconnect();
      }
    }
    reload.current = scheduleRefresh;
    scheduleRefresh();
    connect();
    const onFocus = () => {
      if (document.visibilityState !== 'hidden') scheduleRefresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      controller.abort();
      clearTimeout(debounce);
      clearTimeout(reconnect);
      reload.current = () => {};
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [userId]);

  const refresh = useCallback(() => reload.current(), []);
  const markRead = useCallback(
    async id => {
      const version = getSessionVersion();
      const current = generation.current;
      const response = await learningApi.markNotificationRead(id);
      if (version === getSessionVersion() && current === generation.current) {
        setRevision(value => value + 1);
        refresh();
      }
      return response;
    },
    [refresh],
  );
  const markAllRead = useCallback(async () => {
    const version = getSessionVersion();
    const current = generation.current;
    const response = await learningApi.markAllNotificationsRead();
    if (version === getSessionVersion() && current === generation.current) {
      setState({ userId, summary: response.data, loading: false, error: null });
      setRevision(value => value + 1);
      refresh();
    }
    return response;
  }, [userId, refresh]);

  const visible = userId != null && state.userId === userId ? state : initialState;
  const value = useMemo(
    () => ({
      ...visible,
      userId,
      revision,
      refresh,
      markRead,
      markAllRead,
    }),
    [visible, userId, revision, refresh, markRead, markAllRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
