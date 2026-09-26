import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

export const paymentApi = {
  createCheckout: payload => axiosClient.post(`${ENDPOINTS.payments}/checkout`, payload),
  getOrder: orderCode => axiosClient.get(`${ENDPOINTS.payments}/orders/${encodeURIComponent(orderCode)}`),
  getHistory: ({ page = 0, size = 10, keyword = '', status = '' } = {}) => {
    const params = { page, size };
    if (keyword.trim()) params.keyword = keyword.trim();
    if (status) params.status = status;
    return axiosClient.get(`${ENDPOINTS.payments}/history`, { params });
  },
  getAdminAnalytics: () => axiosClient.get(`${ENDPOINTS.payments}/admin/analytics`),
};
