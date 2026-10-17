import axiosClient, { refreshAccessToken } from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

export const authApi = {
  forgotPassword: ({ email }, options = {}) =>
    axiosClient.post(ENDPOINTS.auth.forgotPassword, { email }, { ...options, skipAuth: true }),
  resetPassword: ({ token, newPassword, confirmPassword }, options = {}) =>
    axiosClient.post(
      ENDPOINTS.auth.resetPassword,
      { token, newPassword, confirmPassword },
      { ...options, skipAuth: true },
    ),
  startGoogleLink: ({ currentPassword, challenge }, options = {}) =>
    axiosClient.post(ENDPOINTS.googleLink.start, { currentPassword, challenge }, options),
  completeGoogleLink: ({ code, verifier }, options = {}) =>
    axiosClient.post(ENDPOINTS.googleLink.complete, { code, verifier }, options),
  startGoogle: (challenge, options = {}) =>
    axiosClient.post(ENDPOINTS.auth.googleStart, { challenge }, { ...options, skipAuth: true }),
  exchangeGoogle: ({ code, verifier }, options = {}) =>
    axiosClient.post(ENDPOINTS.auth.googleExchange, { code, verifier }, { ...options, skipAuth: true }),
  login: ({ email, password }, options = {}) =>
    axiosClient.post(ENDPOINTS.auth.login, { email, password }, { ...options, skipAuth: true }),
  register: ({ fullName, email, password }, options = {}) =>
    axiosClient.post(ENDPOINTS.auth.register, { fullName, email, password }, { ...options, skipAuth: true }),
  getMe: (options = {}) => axiosClient.get(ENDPOINTS.users.me, options),
  refresh: (options = {}) => refreshAccessToken(options),
  logout: (options = {}) => axiosClient.post(ENDPOINTS.auth.logout, {}, { ...options, skipAuth: true }),
};
