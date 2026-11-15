import axiosClient from '../../../shared/apis/axiosClient';
import { API_PREFIX } from '../../../shared/constants/appConstants';
const base = `${API_PREFIX}/learning/community`;
export const communityApi = {
  topics: options => axiosClient.get(`${base}/topics`, options),
  posts: (params, options = {}) => axiosClient.get(`${base}/posts`, { ...options, params }),
  post: (id, options) => axiosClient.get(`${base}/posts/${id}`, options),
  create: payload => axiosClient.post(`${base}/posts`, payload),
  update: (id, payload) => axiosClient.put(`${base}/posts/${id}`, payload),
  remove: id => axiosClient.delete(`${base}/posts/${id}`),
  lock: (id, locked) => axiosClient.patch(`${base}/posts/${id}/lock`, { locked }),
  comments: (id, params, options = {}) =>
    axiosClient.get(`${base}/posts/${id}/comments`, { ...options, params }),
  addComment: (id, body) => axiosClient.post(`${base}/posts/${id}/comments`, { body }),
  updateComment: (id, commentId, body) =>
    axiosClient.put(`${base}/posts/${id}/comments/${commentId}`, { body }),
  removeComment: (id, commentId) => axiosClient.delete(`${base}/posts/${id}/comments/${commentId}`),
  answer: (id, commentId) => axiosClient.patch(`${base}/posts/${id}/answer`, { commentId }),
};
