import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

export const userApi = {
  adminCreateUser: payload => axiosClient.post(ENDPOINTS.adminUsers, payload),
  adminUpdateUser: (id, payload) => axiosClient.put(`${ENDPOINTS.adminUsers}/${id}`, payload),
  updateProfile: (payload, options = {}) => axiosClient.put(ENDPOINTS.users.me, payload, options),

  changePassword: (payload, options = {}) =>
    axiosClient.put(ENDPOINTS.users.changePassword, payload, options),

  adminListUsers: (params = {}, options = {}) =>
    axiosClient.get(ENDPOINTS.adminUsers, { ...options, params }),

  adminGetUser: (id, options = {}) => axiosClient.get(`${ENDPOINTS.adminUsers}/${id}`, options),

  adminUpdateStatus: (id, status, options = {}) =>
    axiosClient.patch(`${ENDPOINTS.adminUsers}/${id}/status`, { status }, options),

  adminUpdateRoles: (id, roles, options = {}) =>
    axiosClient.put(`${ENDPOINTS.adminUsers}/${id}/roles`, { roles }, options),
};
