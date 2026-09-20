import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

export const courseApi = {
  list: (params = {}) => axiosClient.get(ENDPOINTS.courses, { params }),
  getById: id => axiosClient.get(`${ENDPOINTS.courses}/${id}`),
  create: payload => axiosClient.post(`${ENDPOINTS.courses}/admin/courses`, payload),
  update: (id, payload) => axiosClient.put(`${ENDPOINTS.courses}/admin/courses/${id}`, payload),
  delete: id => axiosClient.delete(`${ENDPOINTS.courses}/admin/courses/${id}`),
};
