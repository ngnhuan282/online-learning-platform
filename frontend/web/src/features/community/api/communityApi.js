import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

const posts = ENDPOINTS.community.posts;
export const communityApi = {
  topics: options => axiosClient.get(ENDPOINTS.community.topics, options),
  posts: (params, options = {}) => axiosClient.get(posts, { ...options, params }),
  post: (id, options) => axiosClient.get(`${posts}/${id}`, options),
  create: payload => axiosClient.post(posts, payload),
  update: (id, payload) => axiosClient.put(`${posts}/${id}`, payload),
  remove: id => axiosClient.delete(`${posts}/${id}`),
  lock: (id, locked) => axiosClient.patch(`${posts}/${id}/lock`, { locked }),
  comments: (id, params, options = {}) => axiosClient.get(`${posts}/${id}/comments`, { ...options, params }),
  addComment: (id, body) => axiosClient.post(`${posts}/${id}/comments`, { body }),
  updateComment: (id, commentId, body) => axiosClient.put(`${posts}/${id}/comments/${commentId}`, { body }),
  removeComment: (id, commentId) => axiosClient.delete(`${posts}/${id}/comments/${commentId}`),
  answer: (id, commentId) => axiosClient.patch(`${posts}/${id}/answer`, { commentId }),
};
