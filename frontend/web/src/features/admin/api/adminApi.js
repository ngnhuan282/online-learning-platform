import axiosClient from '../../../shared/apis/axiosClient';

export const adminApi = {
  overview: options => axiosClient.get('/api/v1/admin/overview', { signal: options?.signal }),
  courses: options => axiosClient.get('/api/v1/admin/courses/overview', { signal: options?.signal }),
  learning: options => axiosClient.get('/api/v1/learning/admin/overview', { signal: options?.signal }),
  payments: options => axiosClient.get('/api/v1/payments/admin/analytics', { signal: options?.signal }),
  paymentOrders: (params, options) =>
    axiosClient.get('/api/v1/payments/admin/orders', { params, signal: options?.signal }),
  commerceAnalytics: (report, range, options) =>
    axiosClient.get(`/api/v1/learning/admin/analytics/${report}`, {
      params: range ?? undefined,
      signal: options?.signal,
    }),
  roles: () => axiosClient.get('/api/v1/admin/roles'),
  permissions: () => axiosClient.get('/api/v1/admin/permissions'),
  createRole: payload => axiosClient.post('/api/v1/admin/roles', payload),
  updateRole: (id, payload) => axiosClient.put(`/api/v1/admin/roles/${id}`, payload),
  deleteRole: id => axiosClient.delete(`/api/v1/admin/roles/${id}`),
  audit: () => axiosClient.get('/api/v1/admin/audit'),
};
