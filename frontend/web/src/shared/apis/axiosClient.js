import axios from 'axios';
import { API_PREFIX, API_TIMEOUT_MS } from '../constants/appConstants';
import {
  clearTokens,
  getAccessToken,
  getSessionVersion,
  isTokenExpired,
  setAccessToken,
} from '../utils/tokenUtils';
import { normalizeApiError } from '../utils/errorUtils';
import { ENDPOINTS } from './endpoints';

const gatewayUrl = (import.meta.env.VITE_API_URL?.trim() || globalThis.window?.location?.origin)?.replace(
  /\/$/,
  '',
);
const axiosClient = axios.create({ baseURL: gatewayUrl, timeout: API_TIMEOUT_MS, withCredentials: true });
const authPaths = new Set(Object.values(ENDPOINTS.auth));
let refreshFlight = null;

export function refreshAccessToken(options = {}) {
  const version = getSessionVersion();
  if (refreshFlight) return refreshFlight.promise;
  const flight = { version };
  flight.promise = axiosClient
    .post(ENDPOINTS.auth.refresh, {}, { ...options, skipAuth: true })
    .then(response => {
      if (getSessionVersion() !== version)
        throw Object.assign(new Error('Session changed.'), { code: 'ERR_CANCELED' });
      setAccessToken(response.data?.accessToken, { preserveSession: true });
      return response;
    })
    .catch(error => {
      if (getSessionVersion() === version) clearTokens();
      throw error;
    })
    .finally(() => {
      if (refreshFlight === flight) refreshFlight = null;
    });
  refreshFlight = flight;
  return flight.promise;
}

// Logout waits for a rotating response's Set-Cookie before revoking the resulting cookie.
export async function waitForRefresh() {
  try {
    await refreshFlight?.promise;
  } catch {
    /* The logout request still needs to run. */
  }
}

axiosClient.interceptors.request.use(config => {
  // Keep public/demo UI usable without configuration; reject only actual API requests.
  if (!gatewayUrl || !/^https?:\/\/[^/]+$/.test(gatewayUrl)) {
    throw Object.assign(new Error('Cần cấu hình VITE_API_URL là địa chỉ API Gateway.'), {
      normalized: true,
      code: 'API_CONFIGURATION_ERROR',
    });
  }
  if (
    config.baseURL !== gatewayUrl ||
    !config.url?.startsWith(`${API_PREFIX}/`) ||
    config.url.includes('..')
  ) {
    throw Object.assign(new Error('API requests must use the configured Gateway and /api/v1 prefix.'), {
      normalized: true,
      code: 'INVALID_API_URL',
    });
  }
  const token = getAccessToken();
  config.sessionVersion ??= getSessionVersion();
  if (config.sessionVersion !== getSessionVersion())
    throw Object.assign(new Error('Session changed.'), { code: 'ERR_CANCELED' });
  config.sessionToken = token;
  if (!config.skipAuth && !authPaths.has(config.url) && token && !isTokenExpired(token)) {
    config.headers.set('Authorization', `Bearer ${token}`);
    config.sessionToken = token;
  } else config.headers.delete('Authorization');
  return config;
});
axiosClient.interceptors.response.use(
  response => {
    if (response.config.sessionVersion !== getSessionVersion()) {
      throw normalizeApiError(Object.assign(new Error('Session changed.'), { code: 'ERR_CANCELED' }));
    }
    return response.data;
  },
  async error => {
    const config = error.config;
    // A response from an ended session must never clear or populate a newer session.
    if (config && config.sessionVersion !== getSessionVersion()) {
      return Promise.reject(
        normalizeApiError(Object.assign(new Error('Session changed.'), { code: 'ERR_CANCELED' })),
      );
    }
    if (
      error.response?.status === 403 &&
      ['ACCOUNT_LOCKED', 'ACCOUNT_DISABLED'].includes(error.response?.data?.code)
    ) {
      clearTokens();
    }
    if (
      error.response?.status === 401 &&
      config &&
      !config.skipAuth &&
      !authPaths.has(config.url) &&
      config.sessionVersion === getSessionVersion()
    ) {
      if (config.retriedAfterRefresh) {
        clearTokens();
      } else {
        config.retriedAfterRefresh = true;
        try {
          // A delayed 401 from the same session can use the token another request just refreshed.
          if (
            !getAccessToken() ||
            isTokenExpired(getAccessToken()) ||
            config.sessionToken === getAccessToken()
          ) {
            await refreshAccessToken({ adapter: config.adapter });
          }
          if (config.sessionVersion !== getSessionVersion())
            throw Object.assign(new Error('Session changed.'), { code: 'ERR_CANCELED' });
          return axiosClient(config);
        } catch (refreshError) {
          return Promise.reject(normalizeApiError(refreshError));
        }
      }
    }
    return Promise.reject(normalizeApiError(error));
  },
);
export default axiosClient;
