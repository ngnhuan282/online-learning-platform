import axiosClient from '../../../shared/apis/axiosClient';
import { API_PREFIX } from '../../../shared/constants/appConstants';

const BASE = `${API_PREFIX}/admin`;

export const lessonApi = {
  /** ADMIN: tạo lesson trong section */
  create: (sectionId, payload) =>
    axiosClient.post(`${BASE}/sections/${sectionId}/lessons`, payload),

  /** ADMIN: cập nhật lesson */
  update: (lessonId, payload) =>
    axiosClient.put(`${BASE}/lessons/${lessonId}`, payload),

  /** ADMIN: xóa lesson */
  delete: lessonId =>
    axiosClient.delete(`${BASE}/lessons/${lessonId}`),

  /** ADMIN: reorder lessons trong section — body: { items: [{id, orderIndex}] } */
  reorder: (sectionId, items) =>
    axiosClient.put(`${BASE}/sections/${sectionId}/lessons/reorder`, { items }),

  /** PUBLIC/USER: Lấy URL phát bài học (Pre-signed URL có bảo vệ) */
  getPlayUrl: (courseId, lessonId) =>
    axiosClient.get(`${API_PREFIX}/courses/${courseId}/lessons/${lessonId}/play-url`),
};
