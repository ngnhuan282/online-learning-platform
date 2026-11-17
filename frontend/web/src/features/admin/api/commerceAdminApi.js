import client from '../../../shared/apis/axiosClient';
import { notifyEngagementChanged } from '../../engagement/utils/engagementEvents';
import { notifyProChanged } from '../../pro/api/proApi';
const learning = '/api/v1/learning/admin';
const payment = '/api/v1/payments/admin';
const changed = promise =>
  promise.then(response => {
    notifyEngagementChanged();
    notifyProChanged();
    return response;
  });
export const commerceAdminApi = {
  deleteComment: (postId, id, payload) =>
    client.delete(`${learning}/community/posts/${postId}/comments/${id}`, { data: payload }),
  restoreComment: (postId, id, payload) =>
    client.post(`${learning}/community/posts/${postId}/comments/${id}/restore`, payload),
  deleteItem: (code, payload) => changed(client.delete(`${learning}/shop/items/${code}`, { data: payload })),
  restoreItem: (code, payload) => changed(client.post(`${learning}/shop/items/${code}/restore`, payload)),
  createReward: payload => changed(client.post(`${learning}/engagement/rewards`, payload)),
  updateReward: (code, payload) =>
    changed(client.put(`${learning}/engagement/rewards/${code}/definition`, payload)),
  deleteReward: (code, payload) =>
    changed(client.delete(`${learning}/engagement/rewards/${code}`, { data: payload })),
  restoreReward: (code, payload) =>
    changed(client.post(`${learning}/engagement/rewards/${code}/restore`, payload)),
  createPlan: payload => changed(client.post(`${payment}/pro/plans`, payload)),
  deletePlan: (code, payload) => changed(client.delete(`${payment}/pro/plans/${code}`, { data: payload })),
  restorePlan: (code, payload) => changed(client.post(`${payment}/pro/plans/${code}/restore`, payload)),
  updateGrant: (userId, id, payload) =>
    changed(client.put(`${learning}/pro/members/${userId}/grants/${id}`, payload)),
  createPost: payload => client.post(`${learning}/community/posts`, payload),
  updatePost: (id, payload) => client.put(`${learning}/community/posts/${id}`, payload),
  deletePost: (id, payload) => client.delete(`${learning}/community/posts/${id}`, { data: payload }),
  restorePost: (id, payload) => client.post(`${learning}/community/posts/${id}/restore`, payload),
  createComment: (id, payload) => client.post(`${learning}/community/posts/${id}/comments`, payload),
  updateComment: (postId, id, payload) =>
    client.put(`${learning}/community/posts/${postId}/comments/${id}`, payload),
  updateCode: (id, payload) => client.put(`${learning}/pro/codes/${id}`, payload),
  inventory: (id, options) => client.get(`${learning}/engagement/learners/${id}/inventory`, options),
  saveInventory: (id, code, payload) =>
    changed(client.put(`${learning}/engagement/learners/${id}/inventory/${code}`, payload)),
  items: options => client.get(`${learning}/shop/items`, options),
  saveItem: (item, create) =>
    changed(
      create
        ? client.post(`${learning}/shop/items`, item)
        : client.put(`${learning}/shop/items/${item.code}`, item),
    ),
  purchases: (params, options) => client.get(`${learning}/shop/purchases`, { ...options, params }),
  learners: (params, options) => client.get(`${learning}/engagement/learners`, { ...options, params }),
  learner: (id, options) => client.get(`${learning}/engagement/learners/${id}`, options),
  adjustments: (id, options) => client.get(`${learning}/engagement/learners/${id}/adjustments`, options),
  adjust: (id, payload) => changed(client.post(`${learning}/engagement/learners/${id}/adjustments`, payload)),
  settings: options => client.get(`${learning}/engagement/settings`, options),
  saveSettings: payload => changed(client.put(`${learning}/engagement/settings`, payload)),
  rewards: options => client.get(`${learning}/engagement/rewards`, options),
  saveReward: (code, payload) => changed(client.put(`${learning}/engagement/rewards/${code}`, payload)),
  plans: options => client.get(`${payment}/pro/plans`, options),
  savePlan: (code, payload) => changed(client.put(`${payment}/pro/plans/${code}`, payload)),
  members: (params, options) => client.get(`${learning}/pro/members`, { ...options, params }),
  member: (id, options) => client.get(`${learning}/pro/members/${id}`, options),
  grant: (id, payload) => changed(client.post(`${learning}/pro/members/${id}/grants`, payload)),
  suspend: (id, payload) => changed(client.patch(`${learning}/pro/members/${id}/suspension`, payload)),
  revokeGrant: (userId, id, payload) =>
    changed(client.post(`${learning}/pro/members/${userId}/grants/${id}/revoke`, payload)),
  posts: (params, options) => client.get(`${learning}/community/posts`, { ...options, params }),
  moderate: (id, payload) => client.patch(`${learning}/community/posts/${id}`, payload),
  comments: (id, options) => client.get(`${learning}/community/posts/${id}/comments`, options),
  moderateComment: (postId, id, payload) =>
    client.patch(`${learning}/community/posts/${postId}/comments/${id}`, payload),
  learningAudit: () => client.get(`${learning}/audit`),
  paymentAudit: () => client.get(`${payment}/audit`),
};
