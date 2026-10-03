import axiosClient from '../../../shared/apis/axiosClient';
import { API_PREFIX } from '../../../shared/constants/appConstants';

const BASE = API_PREFIX;

export const sectionApi = {
  /** Lấy toàn bộ section + lesson của course (public) */
  listByCourse: courseId =>
    axiosClient.get(`${BASE}/courses/${courseId}/sections`),

  /** ADMIN: tạo section mới */
  create: (courseId, payload) =>
    axiosClient.post(`${BASE}/admin/courses/${courseId}/sections`, payload),

  /** ADMIN: cập nhật section */
  update: (courseId, sectionId, payload) =>
    axiosClient.put(`${BASE}/admin/courses/${courseId}/sections/${sectionId}`, payload),

  /** ADMIN: xóa section */
  delete: (courseId, sectionId) =>
    axiosClient.delete(`${BASE}/admin/courses/${courseId}/sections/${sectionId}`),

  /** ADMIN: reorder sections — body: { items: [{id, orderIndex}] } */
  reorder: (courseId, items) =>
    axiosClient.put(`${BASE}/admin/courses/${courseId}/sections/reorder`, { items }),
};
