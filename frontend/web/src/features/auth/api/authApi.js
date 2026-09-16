import axiosClient, { refreshAccessToken } from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

export const authApi = {
  login: ({ email, password }, options = {}) =>
    axiosClient.post(ENDPOINTS.auth.login, { email, password }, { ...options, skipAuth: true }),
  register: ({ fullName, email, password }, options = {}) =>
    axiosClient.post(ENDPOINTS.auth.register, { fullName, email, password }, { ...options, skipAuth: true }),
  getMe: (options = {}) => axiosClient.get(ENDPOINTS.users.me, options),
  refresh: (options = {}) => refreshAccessToken(options),
  logout: (options = {}) => axiosClient.post(ENDPOINTS.auth.logout, {}, { ...options, skipAuth: true }),
};
