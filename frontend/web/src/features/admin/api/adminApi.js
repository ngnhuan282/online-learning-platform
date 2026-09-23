import axiosClient from '../../../shared/apis/axiosClient';

export const adminApi = {
  overview: () => axiosClient.get('/api/v1/admin/overview'),
  courses: () => axiosClient.get('/api/v1/admin/courses/overview'),
  learning: () => axiosClient.get('/api/v1/learning/admin/overview'),
  payments: () => axiosClient.get('/api/v1/payments/admin/analytics'),
  roles: () => axiosClient.get('/api/v1/admin/roles'),
  permissions: () => axiosClient.get('/api/v1/admin/permissions'),
  createRole: payload => axiosClient.post('/api/v1/admin/roles', payload),
  updateRole: (id, payload) => axiosClient.put(`/api/v1/admin/roles/${id}`, payload),
  deleteRole: id => axiosClient.delete(`/api/v1/admin/roles/${id}`),
  audit: () => axiosClient.get('/api/v1/admin/audit'),
};
