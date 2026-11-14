import axiosClient from '../../../shared/apis/axiosClient';
import { API_PREFIX } from '../../../shared/constants/appConstants';

export const categoryApi = {
  adminList: (options = {}) => axiosClient.get(`${API_PREFIX}/admin/categories`, options),
  list: (options = {}) => axiosClient.get(`${API_PREFIX}/categories`, options),
  getById: id => axiosClient.get(`${API_PREFIX}/categories/${id}`),
  create: payload => axiosClient.post(`${API_PREFIX}/admin/categories`, payload),
  update: (id, payload) => axiosClient.put(`${API_PREFIX}/admin/categories/${id}`, payload),
  delete: id => axiosClient.delete(`${API_PREFIX}/admin/categories/${id}`),
};
