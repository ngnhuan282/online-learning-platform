import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { AUTH_CHANGED_EVENT } from '../../../shared/constants/appConstants';
import {
  allowSessionRestore,
  clearTokens,
  decodeToken,
  getAccessToken,
  invalidateSessionRequests,
  isTokenExpired,
  setAccessToken,
  wasSessionCleared,
} from '../../../shared/utils/tokenUtils';
import { waitForRefresh } from '../../../shared/apis/axiosClient';
import { authApi } from '../api/authApi';

// Context is exported for useAuth, alongside its provider.
// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);
const subscribe = callback => {
  window.addEventListener(AUTH_CHANGED_EVENT, callback);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, callback);
};
const validUser = user =>
  user?.id != null &&
  Array.isArray(user.roles) &&
  user.roles.length > 0 &&
  user.roles.every(role => typeof role === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(role));

export function AuthProvider({ children }) {
  const token = useSyncExternalStore(subscribe, getAccessToken, () => null);
  const sessionWasCleared = useSyncExternalStore(subscribe, wasSessionCleared, () => false);
  const [session, setSession] = useState(null);
  const [restoreState, setRestoreState] = useState(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const pendingLogin = useRef(null);
  const pendingLogout = useRef(null);
  const restoreRefresh = useRef(null);
  const claims = useMemo(() => decodeToken(token), [token]);
  const valid = Boolean(token && claims?.sub && !isTokenExpired(token));
  const currentUser = valid && session?.token === token ? session.user : null;
  useEffect(() => {
    if (
      currentUser ||
      isLoggingOut ||
      (!valid && (loggedOut || sessionWasCleared)) ||
      (restoreState?.token === token && restoreState.error)
    )
      return undefined;
    const controller = new AbortController();
    const attempt = generation.current;
    (async () => {
      try {
        if (!valid) {
          restoreRefresh.current ??= authApi.refresh();
          await restoreRefresh.current;
        }
        if (controller.signal.aborted || attempt !== generation.current) return;
        const { data } = await authApi.getMe({ signal: controller.signal });
        if (controller.signal.aborted || attempt !== generation.current) return;
        const restoredToken = getAccessToken();
        if (!validUser(data) || String(data.id) !== decodeToken(restoredToken)?.sub) {
          clearTokens();
          setLoggedOut(true);
          setSession(null);
          return;
        }
        setSession({ token: restoredToken, user: data });
        setRestoreState(null);
      } catch (error) {
        if (attempt !== generation.current || error.code === 'ERR_CANCELED') return;
        // A failed refresh can clear the token and cancel this effect before its catch runs.
        if (controller.signal.aborted && getAccessToken()) return;
        if ([401, 403, 404].includes(error.status)) {
          clearTokens();
          setLoggedOut(true);
          setSession(null);
          setRestoreState(null);
        } else setRestoreState({ token: getAccessToken(), error });
      }
    })();
    return () => controller.abort();
  }, [token, valid, currentUser, retry, loggedOut, sessionWasCleared, isLoggingOut, restoreState]);
  const establishSession = useCallback(({ accessToken, user }) => {
    const next = decodeToken(accessToken);
    if (!next?.sub || isTokenExpired(accessToken) || !validUser(user) || String(user.id) !== next.sub) {
      throw new Error('Invalid authentication response.');
    }
    setAccessToken(accessToken);
    setSession({ token: accessToken, user });
    setLoggedOut(false);
    restoreRefresh.current = null;
    setRestoreState(null);
  }, []);
  const authenticate = useCallback(
    async requestLogin => {
      if (pendingLogout.current) throw new Error('Vui lòng chờ đăng xuất hoàn tất.');
      const attempt = ++generation.current;
      // Finish any cookie rotation before a new login sets its own session cookie.
      await waitForRefresh();
      if (attempt !== generation.current) throw new Error('Yêu cầu đăng nhập đã bị hủy.');
      const request = requestLogin();
      pendingLogin.current = request;
      let response;
      try {
        response = await request;
      } finally {
        if (pendingLogin.current === request) pendingLogin.current = null;
      }
      if (attempt !== generation.current) throw new Error('Yêu cầu đăng nhập đã bị hủy.');
      establishSession(response.data);
      return response.data.user;
    },
    [establishSession],
  );
  const login = useCallback(values => authenticate(() => authApi.login(values)), [authenticate]);
  const completeGoogleLogin = useCallback(
    values => authenticate(() => authApi.exchangeGoogle(values)),
    [authenticate],
  );
  const register = useCallback(async values => (await authApi.register(values)).data, []);
  const updateCurrentUser = useCallback(nextUser => {
    const currentToken = getAccessToken();
    if (validUser(nextUser) && String(nextUser.id) === decodeToken(currentToken)?.sub) {
      setSession({ token: currentToken, user: nextUser });
    }
  }, []);
  const logout = useCallback(() => {
    if (pendingLogout.current) return pendingLogout.current;
    generation.current++;
    invalidateSessionRequests();
    setIsLoggingOut(true);
    const request = (async () => {
      let error = null;
      try {
        await waitForRefresh();
        try {
          await pendingLogin.current;
        } catch {
          /* Failed login cannot prevent logout. */
        }
        await authApi.logout();
      } catch (failure) {
        error = failure;
      } finally {
        clearTokens();
        setSession(null);
        setRestoreState(null);
        setLoggedOut(true);
        setIsLoggingOut(false);
        pendingLogout.current = null;
      }
      return { error };
    })();
    pendingLogout.current = request;
    return request;
  }, []);
  const retrySession = useCallback(() => {
    restoreRefresh.current = null;
    allowSessionRestore();
    setLoggedOut(false);
    setRestoreState(null);
    setRetry(value => value + 1);
  }, []);
  const sessionError = restoreState?.token === token ? restoreState.error : null;
  const value = useMemo(
    () => ({
      user: currentUser,
      currentUser,
      isAuthenticated: Boolean(currentUser),
      isLoading: (valid || (!loggedOut && !sessionWasCleared)) && !currentUser && !sessionError,
      isLoggingOut,
      sessionError,
      retrySession,
      establishSession,
      login,
      completeGoogleLogin,
      register,
      updateCurrentUser,
      logout,
    }),
    [
      currentUser,
      valid,
      loggedOut,
      sessionWasCleared,
      isLoggingOut,
      sessionError,
      retrySession,
      establishSession,
      login,
      completeGoogleLogin,
      register,
      updateCurrentUser,
      logout,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
