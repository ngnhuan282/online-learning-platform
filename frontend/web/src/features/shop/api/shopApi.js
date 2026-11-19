import axiosClient from '../../../shared/apis/axiosClient';
import { API_PREFIX } from '../../../shared/constants/appConstants';
import { notifyEngagementChanged } from '../../engagement/utils/engagementEvents';
const base = `${API_PREFIX}/learning/shop`;
const update = promise =>
  promise.then(response => {
    notifyEngagementChanged();
    return response;
  });
export const shopApi = {
  state: options => axiosClient.get(base, options),
  purchase: (itemCode, requestId) => update(axiosClient.post(`${base}/purchases`, { itemCode, requestId })),
  equip: (itemType, itemCode) => update(axiosClient.post(`${base}/equip`, { itemType, itemCode })),
};
