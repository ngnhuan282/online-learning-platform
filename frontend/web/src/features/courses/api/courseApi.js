import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';
import { API_PREFIX } from '../../../shared/constants/appConstants';

export const courseApi = {
  list: (params = {}) => axiosClient.get(ENDPOINTS.courses, { params }),
  getById: id => axiosClient.get(`${ENDPOINTS.courses}/${id}`),
  create: payload => axiosClient.post(`${API_PREFIX}/admin/courses`, payload),
  update: (id, payload) => axiosClient.put(`${API_PREFIX}/admin/courses/${id}`, payload),
  delete: id => axiosClient.delete(`${API_PREFIX}/admin/courses/${id}`),
};
