import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

export const aiApi = {
  getCapabilities: options => axiosClient.get(`${ENDPOINTS.ai}/capabilities`, options),
  getConversations: ({ page = 0, size = 20 } = {}) =>
    axiosClient.get(`${ENDPOINTS.ai}/conversations`, { params: { page, size } }),
  createConversation: ({ title, courseId, lessonId } = {}) =>
    axiosClient.post(`${ENDPOINTS.ai}/conversations`, { title, courseId, lessonId }),
  getMessages: conversationId =>
    axiosClient.get(`${ENDPOINTS.ai}/conversations/${encodeURIComponent(conversationId)}/messages`),
  sendMessage: (conversationId, content) =>
    axiosClient.post(`${ENDPOINTS.ai}/conversations/${encodeURIComponent(conversationId)}/messages`, {
      content,
    }),
};
