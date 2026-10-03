import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

export const paymentApi = {
  createCheckout: payload => axiosClient.post(`${ENDPOINTS.payments}/checkout`, payload),
  getOrder: orderCode => axiosClient.get(`${ENDPOINTS.payments}/orders/${encodeURIComponent(orderCode)}`),
  completeMockPayment: (orderCode, payload) =>
    axiosClient.post(`${ENDPOINTS.payments}/mock/orders/${encodeURIComponent(orderCode)}/complete`, payload),
  getHistory: ({ page = 0, size = 10, keyword = '', status = '' } = {}) => {
    const params = { page, size };
    if (keyword.trim()) params.keyword = keyword.trim();
    if (status) params.status = status;
    return axiosClient.get(`${ENDPOINTS.payments}/history`, { params });
  },
  getAdminAnalytics: () => axiosClient.get(`${ENDPOINTS.payments}/admin/analytics`),
  getAdminOrders: ({ page = 0, size = 10, keyword = '', status = '' } = {}) => {
    const params = { page, size };
    if (keyword.trim()) params.keyword = keyword.trim();
    if (status) params.status = status;
    return axiosClient.get(`${ENDPOINTS.payments}/admin/orders`, { params });
  },
  getAdminOrder: orderCode =>
    axiosClient.get(`${ENDPOINTS.payments}/admin/orders/${encodeURIComponent(orderCode)}`),
  updateAdminOrderStatus: (orderCode, payload) =>
    axiosClient.patch(`${ENDPOINTS.payments}/admin/orders/${encodeURIComponent(orderCode)}/status`, payload),
};
