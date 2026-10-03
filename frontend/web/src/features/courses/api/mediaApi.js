import axiosClient from '../../../shared/apis/axiosClient';
import { API_PREFIX } from '../../../shared/constants/appConstants';

export const mediaApi = {
  /**
   * Upload file media (Video, Thumbnail, Document) với theo dõi tiến độ %
   * @param {File} file - File cần upload
   * @param {string} folder - Thư mục phân loại (thumbnails, videos, documents)
   * @param {Function} onProgress - Callback nhận { percent, loaded, total }
   */
  upload: (file, folder = 'media', onProgress = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    return axiosClient.post(`${API_PREFIX}/admin/media/upload`, formData, {
      timeout: 300000,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: progressEvent => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress({
            percent,
            loaded: progressEvent.loaded,
            total: progressEvent.total,
          });
        }
      },
    });
  },

  /** Lấy danh sách tài liệu đính kèm của một bài học */
  listResources: lessonId => {
    return axiosClient.get(`${API_PREFIX}/lessons/${lessonId}/resources`);
  },

  /** Thêm tài liệu đính kèm vào bài học */
  addResource: (lessonId, payload) => {
    return axiosClient.post(`${API_PREFIX}/admin/lessons/${lessonId}/resources`, payload);
  },

  /** Xóa tài liệu đính kèm */
  deleteResource: resourceId => {
    return axiosClient.delete(`${API_PREFIX}/admin/resources/${resourceId}`);
  },
};
