import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';
import { API_PREFIX } from '../../../shared/constants/appConstants';

export const courseApi = {
  adminGetById: id => axiosClient.get(`${ENDPOINTS.adminCourses}/${id}`),
  adminList: (params = {}, options = {}) => axiosClient.get(ENDPOINTS.adminCourses, { ...options, params }),
  list: (params = {}, options = {}) => axiosClient.get(ENDPOINTS.courses, { ...options, params }),
  categories: (options = {}) => axiosClient.get(ENDPOINTS.categories, options),
  getById: id => axiosClient.get(`${ENDPOINTS.courses}/${id}`),
  create: payload => axiosClient.post(`${API_PREFIX}/admin/courses`, payload),
  update: (id, payload) => axiosClient.put(`${API_PREFIX}/admin/courses/${id}`, payload),
  delete: id => axiosClient.delete(`${API_PREFIX}/admin/courses/${id}`),
};
