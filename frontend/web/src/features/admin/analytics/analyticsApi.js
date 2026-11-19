import { adminApi } from '../api/adminApi';

const summaryNotice = 'Số liệu tổng hợp toàn thời gian. Máy chủ chưa hỗ trợ lọc hoặc so sánh theo khoảng ngày cho báo cáo này.';

export const analyticsApi = {
  async getRevenueAnalytics(options = {}) {
    const response = await adminApi.payments(options);
    const raw = response.data;
    if (!raw || raw.grossRevenue == null) return null;
    const transactions = (raw.recentTransactions ?? []).map(transaction => ({
      id: transaction.orderCode,
      code: transaction.orderCode,
      userName: `Học viên #${transaction.userId}`,
      courseTitle: transaction.courseTitle,
      amount: Number(transaction.amount),
      status: transaction.status,
      date: transaction.createdAt,
    }));
    return {
      notice: `${summaryNotice} Biểu đồ thể hiện 6 ngày gần nhất.`,
      current: {
        grossRevenue: Number(raw.grossRevenue),
        refundRevenue: Number(raw.refundedAmount ?? 0),
        successfulOrders: raw.successfulPayments,
        pendingOrders: raw.pendingPayments,
        failedOrders: raw.failedPayments,
        series: (raw.revenueSeries ?? []).map(point => ({ label: point.label, current: Number(point.amount) })),
      },
      transactions,
    };
  },

  async getLearnersAnalytics(options = {}) {
    const response = await adminApi.overview(options);
    const raw = response.data;
    if (!raw || raw.total == null) return null;
    return {
      notice: `${summaryNotice} Biểu đồ thể hiện 6 tháng gần nhất.`,
      current: {
        totalUsers: raw.total,
        activeUsers: raw.active,
        newThisWeek: raw.newThisWeek,
        series: (raw.monthly ?? []).map(point => ({ label: point.month, current: point.count })),
      },
    };
  },

};
