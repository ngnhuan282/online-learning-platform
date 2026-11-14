import axiosClient from '../../../shared/apis/axiosClient';
import { API_PREFIX } from '../../../shared/constants/appConstants';

export const reviewApi = {
  /** Public: danh sách review (không ẩn) */
  list: (courseId, params = {}) =>
    axiosClient.get(`${API_PREFIX}/courses/${courseId}/reviews`, { params }),

  /** User: lấy review của chính mình */
  myReview: courseId =>
    axiosClient.get(`${API_PREFIX}/courses/${courseId}/reviews/me`),

  /** User: tạo review */
  create: (courseId, payload) =>
    axiosClient.post(`${API_PREFIX}/courses/${courseId}/reviews`, payload),

  /** User: sửa review */
  update: (courseId, reviewId, payload) =>
    axiosClient.put(`${API_PREFIX}/courses/${courseId}/reviews/${reviewId}`, payload),

  /** User: xóa review */
  delete: (courseId, reviewId) =>
    axiosClient.delete(`${API_PREFIX}/courses/${courseId}/reviews/${reviewId}`),

  /** Admin: danh sách tất cả review toàn hệ thống hoặc theo courseId */
  adminList: (courseId, params = {}) => {
    if (courseId) {
      return axiosClient.get(`${API_PREFIX}/admin/reviews`, { params: { courseId, ...params } });
    }
    return axiosClient.get(`${API_PREFIX}/admin/reviews`, { params });
  },

  /** Admin: danh sách tất cả review toàn hệ thống */
  adminListAll: (params = {}) =>
    axiosClient.get(`${API_PREFIX}/admin/reviews`, { params }),

  /** Admin: cập nhật trạng thái ẩn/hiện review */
  updateVisibility: (reviewId, hidden) =>
    axiosClient.patch(`${API_PREFIX}/admin/reviews/${reviewId}/visibility`, { hidden }),

  /** Admin: ẩn review */
  hide: (courseId, reviewId) =>
    axiosClient.patch(`${API_PREFIX}/admin/reviews/${reviewId}/visibility`, { hidden: true }),

  /** Admin: bỏ ẩn review */
  show: (courseId, reviewId) =>
    axiosClient.patch(`${API_PREFIX}/admin/reviews/${reviewId}/visibility`, { hidden: false }),
};
