import axiosClient from '../../../shared/apis/axiosClient';
import { API_PREFIX } from '../../../shared/constants/appConstants';
export const PRO_CHANGED = 'chitchatgo:pro-changed';
export function notifyProChanged() {
  const view = globalThis.window;
  if (view) view.dispatchEvent(new view.Event(PRO_CHANGED));
}
export const proApi = {
  plans: options => axiosClient.get(`${API_PREFIX}/payments/pro/plans`, options),
  membership: options => axiosClient.get(`${API_PREFIX}/learning/pro/me`, options),
  redeem: async code => {
    const response = await axiosClient.post(`${API_PREFIX}/learning/pro/redeem`, { code });
    notifyProChanged();
    return response;
  },
  codes: options => axiosClient.get(`${API_PREFIX}/learning/admin/pro/codes`, options),
  createCode: payload => axiosClient.post(`${API_PREFIX}/learning/admin/pro/codes`, payload),
  revokeCode: id => axiosClient.delete(`${API_PREFIX}/learning/admin/pro/codes/${id}`),
};
