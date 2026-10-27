import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

export const aiApi = {
  getCapabilities: options => axiosClient.get(`${ENDPOINTS.ai}/capabilities`, options),
  getConversations: ({ page = 0, size = 20 } = {}, options = {}) =>
    axiosClient.get(`${ENDPOINTS.ai}/conversations`, { ...options, params: { page, size } }),
  getConversation: (conversationId, options) =>
    axiosClient.get(`${ENDPOINTS.ai}/conversations/${encodeURIComponent(conversationId)}`, options),
  createConversation: ({ title, courseId, lessonId } = {}) =>
    axiosClient.post(`${ENDPOINTS.ai}/conversations`, { title, courseId, lessonId }),
  getMessages: (conversationId, { page = 0, size = 50 } = {}, options = {}) =>
    axiosClient.get(`${ENDPOINTS.ai}/conversations/${encodeURIComponent(conversationId)}/messages`, {
      ...options,
      params: { page, size },
    }),
  sendMessage: (conversationId, content, requestId, options = {}) =>
    axiosClient.post(
      `${ENDPOINTS.ai}/conversations/${encodeURIComponent(conversationId)}/messages`,
      { content, requestId },
      { ...options, timeout: 90000 },
    ),
};
