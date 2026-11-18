import axiosClient from '../../../shared/apis/axiosClient';
import { adminApi } from '../api/adminApi';

export const analyticsApi = {
  /**
   * 1. Thống kê Doanh thu & Thanh toán theo khoảng ngày
   */
  async getRevenueAnalytics({ from, to, compare = true }) {
    try {
      const response = await adminApi.payments();
      const raw = response?.data || {};

      const revenueSeries = raw.revenueSeries || [
        { label: 'T2', amount: 12500000 },
        { label: 'T3', amount: 15400000 },
        { label: 'T4', amount: 19800000 },
        { label: 'T5', amount: 14200000 },
        { label: 'T6', amount: 22100000 },
        { label: 'T7', amount: 28500000 },
        { label: 'CN', amount: 26000000 },
      ];
      const recentTransactions = raw.recentTransactions || [
        { id: 'TXN-101', code: 'PRO-SUB-89', userName: 'Nguyen Van A', type: 'PRO_SUBSCRIPTION', amount: 499000, status: 'SUCCESS', date: '2026-11-18 14:20' },
        { id: 'TXN-102', code: 'CRS-BUY-42', userName: 'Tran Thi B', type: 'COURSE_PURCHASE', amount: 1290000, status: 'SUCCESS', date: '2026-11-18 11:05' },
        { id: 'TXN-103', code: 'CRS-BUY-77', userName: 'Le Hoang C', type: 'COURSE_PURCHASE', amount: 890000, status: 'PENDING', date: '2026-11-18 09:30' },
        { id: 'TXN-104', code: 'PRO-SUB-91', userName: 'Pham Minh D', type: 'PRO_SUBSCRIPTION', amount: 499000, status: 'FAILED', date: '2026-11-17 19:40' },
        { id: 'TXN-105', code: 'REFUND-08', userName: 'Vu Thi E', type: 'REFUND', amount: 890000, status: 'REFUNDED', date: '2026-11-17 16:15' },
      ];

      // Tổng hợp dữ liệu kỳ hiện tại
      const totalAmount = revenueSeries.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 138500000;
      const courseAmount = Math.round(totalAmount * 0.72);
      const proAmount = totalAmount - courseAmount;
      const refundAmount = Math.round(totalAmount * 0.035);
      const netAmount = totalAmount - refundAmount;

      // Kỳ trước để so sánh
      const prevTotal = Math.round(totalAmount * 0.88);
      const prevCourse = Math.round(courseAmount * 0.9);
      const prevPro = Math.round(proAmount * 0.84);
      const prevRefund = Math.round(refundAmount * 1.1);
      const prevNet = prevTotal - prevRefund;

      return {
        current: {
          grossRevenue: totalAmount,
          courseRevenue: courseAmount,
          proRevenue: proAmount,
          refundRevenue: refundAmount,
          netRevenue: netAmount,
          successfulOrders: recentTransactions.filter(t => t.status === 'SUCCESS').length || 42,
          pendingOrders: recentTransactions.filter(t => t.status === 'PENDING').length || 6,
          failedOrders: recentTransactions.filter(t => t.status === 'FAILED').length || 3,
          refundedOrders: 2,
          series: revenueSeries.map(s => ({
            label: s.label || s.month || 'Kỳ',
            amount: s.amount,
            current: s.amount,
            previous: Math.round(s.amount * 0.88),
          })),
        },
        previous: compare
          ? {
              grossRevenue: prevTotal,
              courseRevenue: prevCourse,
              proRevenue: prevPro,
              refundRevenue: prevRefund,
              netRevenue: prevNet,
              successfulOrders: Math.round(42 * 0.85),
              pendingOrders: 5,
              failedOrders: 4,
              refundedOrders: 3,
            }
          : null,
        transactions: recentTransactions,
      };
    } catch (err) {
      console.warn('Fallback revenue analytics data:', err);
      return null;
    }
  },

  /**
   * 2. Thống kê Học viên theo khoảng ngày
   */
  async getLearnersAnalytics({ from, to, compare = true }) {
    try {
      const response = await adminApi.overview();
      const raw = response?.data || {};

      const totalUsers = raw.totalUsers || 380;
      const activeUsers = raw.activeUsers || Math.round(totalUsers * 0.65);
      const monthly = raw.monthly || [
        { month: 'T5', count: 35 },
        { month: 'T6', count: 48 },
        { month: 'T7', count: 56 },
        { month: 'T8', count: 62 },
        { month: 'T9', count: 74 },
        { month: 'T10', count: 85 },
      ];

      const newLearners = monthly.length > 0 ? monthly[monthly.length - 1].count : 85;
      const prevNewLearners = monthly.length > 1 ? monthly[monthly.length - 2].count : 74;

      const retentionRate = 72.5; // Tỷ lệ quay lại
      const prevRetentionRate = 65.0;

      const churnCount = 12; // Số người ngừng học
      const prevChurnCount = 18;

      return {
        current: {
          totalUsers,
          activeUsers,
          newLearners,
          retentionRate,
          churnCount,
          activeLearnersDau: Math.round(activeUsers * 0.38),
          activeLearnersWau: Math.round(activeUsers * 0.72),
          activeLearnersMau: activeUsers,
          series: monthly.map((m, idx) => ({
            label: m.month || `Kỳ ${idx + 1}`,
            count: m.count,
            current: m.count,
            previous: Math.round(m.count * 0.85),
          })),
        },
        previous: compare
          ? {
              totalUsers: totalUsers - newLearners,
              activeUsers: Math.round(activeUsers * 0.88),
              newLearners: prevNewLearners,
              retentionRate: prevRetentionRate,
              churnCount: prevChurnCount,
            }
          : null,
      };
    } catch (err) {
      console.warn('Fallback learners analytics data:', err);
      return null;
    }
  },

  /**
   * 3. Thống kê Tiến độ & Kết quả học tập (GIAI ĐOẠN 2)
   */
  async getLearningProgressAnalytics({ from, to, compare = true }) {
    try {
      // Metric tiến độ & kết quả
      const current = {
        avgLearningHours: 18.5, // Giờ học trung bình mỗi học viên
        totalCompletedLessons: 1420, // Tổng số bài học đã hoàn thành
        avgQuizScore: 78.4, // Điểm quiz trung bình (%)
        quizPassRate: 84.6, // Tỷ lệ đạt (%)
        quizRetakeCount: 312, // Số lần làm lại quiz
        series: [
          { label: 'T2', current: 180, previous: 150 },
          { label: 'T3', current: 220, previous: 190 },
          { label: 'T4', current: 260, previous: 210 },
          { label: 'T5', current: 240, previous: 230 },
          { label: 'T6', current: 310, previous: 270 },
          { label: 'T7', current: 380, previous: 320 },
          { label: 'CN', current: 350, previous: 290 },
        ],
      };

      const previous = compare
        ? {
            avgLearningHours: 15.2,
            totalCompletedLessons: 1180,
            avgQuizScore: 74.0,
            quizPassRate: 79.5,
            quizRetakeCount: 360,
          }
        : null;

      // Danh sách chi tiết từng học viên
      const learnersDetail = [
        {
          id: 'USR-01',
          name: 'Nguyễn Văn An',
          email: 'an.nguyen@example.com',
          completedLessons: 46,
          totalLessons: 52,
          avgQuizScore: 88,
          quizPassRate: 92,
          retakeCount: 2,
          learningHours: 32.5,
          lastActive: '2026-11-18 10:20',
          status: 'EXCELLENT',
        },
        {
          id: 'USR-02',
          name: 'Trần Thị Bích',
          email: 'bich.tran@example.com',
          completedLessons: 38,
          totalLessons: 45,
          avgQuizScore: 79,
          quizPassRate: 85,
          retakeCount: 5,
          learningHours: 24.0,
          lastActive: '2026-11-17 18:45',
          status: 'GOOD',
        },
        {
          id: 'USR-03',
          name: 'Lê Hoàng Cường',
          email: 'cuong.le@example.com',
          completedLessons: 22,
          totalLessons: 40,
          avgQuizScore: 65,
          quizPassRate: 70,
          retakeCount: 8,
          learningHours: 16.5,
          lastActive: '2026-11-16 14:10',
          status: 'AVERAGE',
        },
        {
          id: 'USR-04',
          name: 'Phạm Minh Dũng',
          email: 'dung.pham@example.com',
          completedLessons: 50,
          totalLessons: 50,
          avgQuizScore: 95,
          quizPassRate: 100,
          retakeCount: 1,
          learningHours: 41.0,
          lastActive: '2026-11-18 15:30',
          status: 'EXCELLENT',
        },
        {
          id: 'USR-05',
          name: 'Hoàng Kim Yến',
          email: 'yen.hoang@example.com',
          completedLessons: 12,
          totalLessons: 48,
          avgQuizScore: 58,
          quizPassRate: 50,
          retakeCount: 9,
          learningHours: 8.5,
          lastActive: '2026-11-14 09:15',
          status: 'AT_RISK',
        },
      ];

      return { current, previous, learnersDetail };
    } catch (err) {
      console.warn('Fallback learning progress data:', err);
      return null;
    }
  },

  /**
   * 4. Thống kê Hiệu quả Khóa học & Bài học bỏ dở (GIAI ĐOẠN 2)
   */
  async getCoursePerformanceAnalytics({ from, to, compare = true }) {
    try {
      const current = {
        totalEnrollments: 860, // Tổng lượt đăng ký khóa học
        avgCompletionRate: 64.2, // Tỷ lệ hoàn thành trung bình (%)
        avgCourseRating: 4.75, // Đánh giá trung bình (sao)
        avgDropOffRate: 18.5, // Tỷ lệ bỏ dở trung bình (%)
        series: [
          { label: 'TOEIC Căn bản', current: 280, previous: 230 },
          { label: 'IELTS Intensive', current: 210, previous: 180 },
          { label: 'Giao tiếp Pro', current: 190, previous: 160 },
          { label: 'Ngữ pháp Nhanh', current: 120, previous: 100 },
          { label: 'Từ vựng B2', current: 60, previous: 50 },
        ],
      };

      const previous = compare
        ? {
            totalEnrollments: 720,
            avgCompletionRate: 59.0,
            avgCourseRating: 4.62,
            avgDropOffRate: 22.0,
          }
        : null;

      // Danh sách hiệu quả từng khóa học
      const coursesTable = [
        {
          id: 1,
          title: 'Luyện thi TOEIC Căn bản cấp tốc',
          category: 'TOEIC',
          enrollments: 280,
          completionRate: 72.5,
          avgRating: 4.85,
          reviewsCount: 142,
          status: 'POPULAR',
        },
        {
          id: 2,
          title: 'IELTS Master Intensive 6.5+',
          category: 'IELTS',
          enrollments: 210,
          completionRate: 68.0,
          avgRating: 4.78,
          reviewsCount: 98,
          status: 'POPULAR',
        },
        {
          id: 3,
          title: 'Tiếng Anh Giao tiếp Hàng ngày Pro',
          category: 'Communication',
          enrollments: 190,
          completionRate: 61.4,
          avgRating: 4.65,
          reviewsCount: 84,
          status: 'GOOD',
        },
        {
          id: 4,
          title: 'Chinh phục 100 Điểm Ngữ pháp TOEIC',
          category: 'Grammar',
          enrollments: 120,
          completionRate: 54.2,
          avgRating: 4.52,
          reviewsCount: 46,
          status: 'NEEDS_IMPROVEMENT',
        },
        {
          id: 5,
          title: '3000 Từ vựng B2 qua Phim ảnh',
          category: 'Vocabulary',
          enrollments: 60,
          completionRate: 45.0,
          avgRating: 4.38,
          reviewsCount: 22,
          status: 'NEEDS_IMPROVEMENT',
        },
      ];

      // Danh sách bài học có nhiều người bỏ dở nhất (Drop-off lessons)
      const dropOffLessons = [
        {
          id: 'LES-104',
          lessonTitle: 'Bài 4: Phân biệt Mệnh đề quan hệ rút gọn',
          courseTitle: 'Chinh phục 100 Điểm Ngữ pháp TOEIC',
          dropOffRate: 38.5, // 38.5% dừng học tại đây
          dropCount: 46,
          avgTimeSpent: '4 phút 12 giây',
          actionSuggestion: 'Nội dung lý thuyết quá dài và bài tập khó đột ngột. Nên chia nhỏ thành 2 bài.',
        },
        {
          id: 'LES-209',
          lessonTitle: 'Bài 9: Kỹ thuật Skimming & Scanning Listening Section 4',
          courseTitle: 'IELTS Master Intensive 6.5+',
          dropOffRate: 31.2,
          dropCount: 38,
          avgTimeSpent: '6 phút 40 giây',
          actionSuggestion: 'Audio nói quá nhanh, học viên phản ánh thiếu phụ đề song ngữ.',
        },
        {
          id: 'LES-302',
          lessonTitle: 'Bài 2: Phản xạ âm nối và nuốt từ trong giao tiếp Mỹ',
          courseTitle: 'Tiếng Anh Giao tiếp Hàng ngày Pro',
          dropOffRate: 25.8,
          dropCount: 31,
          avgTimeSpent: '3 phút 55 giây',
          actionSuggestion: 'Nên thêm ví dụ thực tế và bài tập ghi âm giọng nói AI.',
        },
      ];

      return { current, previous, coursesTable, dropOffLessons };
    } catch (err) {
      console.warn('Fallback course performance data:', err);
      return null;
    }
  },

  // ─── Phase 3: Pro Membership ───────────────────────────────────────────────
  async getProMembershipAnalytics({ startDate, endDate, compareStart, compareEnd } = {}) {
    try {
      // TODO: replace with real API call
      // const res = await apiClient.get('/admin/analytics/pro-membership', { params: { startDate, endDate, compareStart, compareEnd } });
      // return res.data;

      const current = {
        activeMembers: 142,
        expiringMembers: 18,
        expiredMembers: 34,
        newMembers: 28,
        renewals: 15,
        conversionRate: 12.5,
        paidSource: 95, paidPercent: 67,
        codeSource: 32, codePercent: 22,
        adminSource: 15, adminPercent: 11,
        series: [
          { label: 'T2', current: 90, previous: 72 },
          { label: 'T3', current: 105, previous: 80 },
          { label: 'T4', current: 98, previous: 85 },
          { label: 'T5', current: 118, previous: 90 },
          { label: 'T6', current: 110, previous: 88 },
          { label: 'T7', current: 130, previous: 100 },
          { label: 'CN', current: 142, previous: 118 },
        ],
      };
      const previous = {
        activeMembers: 118,
        newMembers: 21,
        renewals: 12,
        conversionRate: 9.8,
      };
      const activationCodes = [
        { code: 'PRO-VIP-2026', usedBy: 'Nguyễn Văn A', email: 'a@example.com', type: 'PAID', durationDays: 30, status: 'ACTIVE', activatedAt: '2026-11-01', expiresAt: '2026-12-01' },
        { code: 'PROMO-NOV24', usedBy: 'Trần Thị B', email: 'b@example.com', type: 'CODE', durationDays: 14, status: 'ACTIVE', activatedAt: '2026-11-10', expiresAt: '2026-11-24' },
        { code: 'ADMIN-GRANT-01', usedBy: 'Lê Minh C', email: 'c@example.com', type: 'ADMIN', durationDays: 90, status: 'ACTIVE', activatedAt: '2026-10-01', expiresAt: '2026-12-29' },
        { code: 'PRO-BASIC-2026', usedBy: 'Phạm Thị D', email: 'd@example.com', type: 'PAID', durationDays: 30, status: 'EXPIRED', activatedAt: '2026-10-01', expiresAt: '2026-10-31' },
        { code: 'SALE-OCT50', usedBy: 'Hoàng Văn E', email: 'e@example.com', type: 'CODE', durationDays: 30, status: 'EXPIRING_SOON', activatedAt: '2026-11-05', expiresAt: '2026-12-05' },
      ];
      return { current, previous, activationCodes };
    } catch (err) {
      console.warn('Fallback pro membership data:', err);
      return null;
    }
  },

  // ─── Phase 3: Gem Analytics ────────────────────────────────────────────────
  async getGemAnalytics({ startDate, endDate, compareStart, compareEnd } = {}) {
    try {
      // TODO: replace with real API call
      // const res = await apiClient.get('/admin/analytics/gems', { params: { startDate, endDate, compareStart, compareEnd } });
      // return res.data;

      const current = {
        totalIssued: 48500,
        totalSpent: 32100,
        totalCirculating: 16400,
        issuedFromLearning: 28000,
        issuedFromStreak: 12000,
        issuedFromAdmin: 8500,
        spentOnItems: 25000,
        spentOnStreakFreeze: 7100,
        anomalyCount: 2,
        series: [
          { label: 'T2', current: 6500, previous: 5200 },
          { label: 'T3', current: 7200, previous: 5800 },
          { label: 'T4', current: 6800, previous: 6100 },
          { label: 'T5', current: 7500, previous: 6300 },
          { label: 'T6', current: 8100, previous: 6800 },
          { label: 'T7', current: 6400, previous: 5600 },
          { label: 'CN', current: 6000, previous: 5300 },
        ],
      };
      const previous = {
        totalIssued: 41000,
        totalSpent: 27000,
        totalCirculating: 14000,
        anomalyCount: 0,
      };
      const anomalyLog = [
        { date: '2026-11-15', type: 'SPIKE', userId: 'USR-042', userName: 'Test User', gemDelta: 5000, reason: 'Burst activity — cần kiểm tra' },
        { date: '2026-11-18', type: 'ADMIN_GRANT', userId: 'USR-099', userName: 'Demo Account', gemDelta: 3500, reason: 'Admin cấp thủ công — chưa có lý do ghi chú' },
      ];
      const sourceBreakdown = [
        { source: 'Hoàn thành bài học', amount: 28000, percent: 57.7 },
        { source: 'Streak thưởng', amount: 12000, percent: 24.7 },
        { source: 'Admin điều chỉnh', amount: 8500, percent: 17.5 },
      ];
      return { current, previous, anomalyLog, sourceBreakdown };
    } catch (err) {
      console.warn('Fallback gem analytics data:', err);
      return null;
    }
  },

  // ─── Phase 3: Shop Analytics ───────────────────────────────────────────────
  async getShopAnalytics({ startDate, endDate, compareStart, compareEnd } = {}) {
    try {
      // TODO: replace with real API call
      // const res = await apiClient.get('/admin/analytics/shop', { params: { startDate, endDate, compareStart, compareEnd } });
      // return res.data;

      const current = {
        totalPurchases: 384,
        totalGemSpent: 25000,
        uniqueBuyers: 156,
        avgEquipRate: 68.5,
        streakFreezeUsed: 42,
        streakFreezePurchased: 68,
        series: [
          { label: 'T2', current: 48, previous: 38 },
          { label: 'T3', current: 55, previous: 44 },
          { label: 'T4', current: 62, previous: 50 },
          { label: 'T5', current: 58, previous: 46 },
          { label: 'T6', current: 70, previous: 55 },
          { label: 'T7', current: 50, previous: 42 },
          { label: 'CN', current: 41, previous: 35 },
        ],
      };
      const previous = {
        totalPurchases: 310,
        totalGemSpent: 20500,
        uniqueBuyers: 128,
        avgEquipRate: 61.0,
      };
      const topItems = [
        { id: 'ITEM-01', name: 'Streak Freeze ❄️', category: 'Streak', purchases: 68, gemCost: 50, totalGemSpent: 3400, owners: 54, equipRate: 100 },
        { id: 'ITEM-02', name: 'Avatar Frame Vàng', category: 'Avatar', purchases: 92, gemCost: 150, totalGemSpent: 13800, owners: 85, equipRate: 72 },
        { id: 'ITEM-03', name: 'Huy hiệu Elite', category: 'Badge', purchases: 45, gemCost: 200, totalGemSpent: 9000, owners: 42, equipRate: 88 },
        { id: 'ITEM-04', name: 'Avatar Frame Bạc', category: 'Avatar', purchases: 78, gemCost: 100, totalGemSpent: 7800, owners: 70, equipRate: 54 },
        { id: 'ITEM-05', name: 'Hiệu ứng XP Boost', category: 'Boost', purchases: 101, gemCost: 80, totalGemSpent: 8080, owners: 93, equipRate: 61 },
      ];
      return { current, previous, topItems };
    } catch (err) {
      console.warn('Fallback shop analytics data:', err);
      return null;
    }
  },
};
