import { adminApi } from '../api/adminApi';

const summaryNotice =
  'Số liệu tổng hợp toàn thời gian. Máy chủ chưa hỗ trợ lọc hoặc so sánh theo khoảng ngày cho báo cáo này.';

export const analyticsApi = {
  async getRevenueAnalytics(options = {}) {
    const response = await adminApi.payments(options);
    const raw = response.data;
    if (!raw || raw.grossRevenue == null) return null;
    const transactions = (raw.recentTransactions ?? []).map(transaction => ({
      id: transaction.orderCode,
      code: transaction.orderCode,
      orderCode: transaction.orderCode,
      userId: transaction.userId,
      userName: `Học viên #${transaction.userId}`,
      courseTitle: transaction.courseTitle,
      amount: Number(transaction.amount ?? 0),
      currency: transaction.currency || 'VND',
      status: transaction.status,
      paymentStatus: transaction.status,
      orderStatus: transaction.orderStatus,
      expiresAt: transaction.expiresAt,
      provider: transaction.provider,
      date: transaction.createdAt,
      createdAt: transaction.createdAt,
    }));
    return {
      notice: `${summaryNotice} Biểu đồ thể hiện 6 ngày gần nhất.`,
      generatedAt: raw.generatedAt ?? null,
      current: {
        grossRevenue: Number(raw.grossRevenue ?? 0),
        pendingAmount: Number(raw.pendingAmount ?? 0),
        refundRevenue: Number(raw.refundedAmount ?? 0),
        totalOrders: Number(raw.totalOrders ?? 0),
        successfulOrders: Number(raw.successfulPayments ?? 0),
        pendingOrders: Number(raw.pendingPayments ?? 0),
        failedOrders: Number(raw.failedPayments ?? 0),
        crossService: raw.crossService ?? null,
        series: (raw.revenueSeries ?? []).map(point => ({
          label: point.label,
          current: Number(point.amount ?? 0),
          orders: Number(point.orders ?? 0),
        })),
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
        totalUsers: Number(raw.total ?? 0),
        activeUsers: Number(raw.active ?? 0),
        lockedUsers: Number(raw.locked ?? 0),
        disabledUsers: Number(raw.disabled ?? 0),
        newThisWeek: Number(raw.newThisWeek ?? 0),
        series: (raw.monthly ?? []).map(point => ({
          rawMonth: point.month,
          label:
            point.month && point.month.length >= 7
              ? `${point.month.slice(5, 7)}/${point.month.slice(0, 4)}`
              : point.month,
          current: Number(point.count ?? 0),
        })),
      },
    };
  },
};
