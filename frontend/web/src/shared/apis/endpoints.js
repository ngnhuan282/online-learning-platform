import { API_PREFIX } from '../constants/appConstants';
export const ENDPOINTS = Object.freeze({
  auth: {
    login: `${API_PREFIX}/auth/login`,
    register: `${API_PREFIX}/auth/register`,
    refresh: `${API_PREFIX}/auth/refresh`,
    logout: `${API_PREFIX}/auth/logout`,
  },
  users: { me: `${API_PREFIX}/users/me` },
  courses: `${API_PREFIX}/courses`,
  learning: `${API_PREFIX}/learning`,
  payments: `${API_PREFIX}/payments`,
  ai: `${API_PREFIX}/ai`,
});
