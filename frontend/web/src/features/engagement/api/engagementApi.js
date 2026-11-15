import axiosClient from '../../../shared/apis/axiosClient';
import { API_PREFIX } from '../../../shared/constants/appConstants';
import { notifyEngagementChanged } from '../utils/engagementEvents';
const base = `${API_PREFIX}/learning/engagement`;
const update = promise =>
  promise.then(response => {
    notifyEngagementChanged();
    return response;
  });
export const engagementApi = {
  summary: options => axiosClient.get(`${base}/me`, options),
  claim: code => update(axiosClient.post(`${base}/rewards/${encodeURIComponent(code)}/claim`)),
  equipFrame: code => update(axiosClient.post(`${base}/frame`, { code })),
  leaderboard: (params, options = {}) => axiosClient.get(`${base}/leaderboard`, { ...options, params }),
};
