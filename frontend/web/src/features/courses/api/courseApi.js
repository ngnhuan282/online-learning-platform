import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

export const courseApi = {
  list: (params = {}, options = {}) => axiosClient.get(ENDPOINTS.courses, { ...options, params }),
  categories: (options = {}) => axiosClient.get(ENDPOINTS.categories, options),
  getById: id => axiosClient.get(`${ENDPOINTS.courses}/${id}`),
  create: payload => axiosClient.post(ENDPOINTS.adminCourses, payload),
  update: (id, payload) => axiosClient.put(`${ENDPOINTS.adminCourses}/${id}`, payload),
  delete: id => axiosClient.delete(`${ENDPOINTS.adminCourses}/${id}`),
};
