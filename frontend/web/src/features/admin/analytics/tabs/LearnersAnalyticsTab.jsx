import { useCallback, useEffect } from 'react';
import { PeopleOutlined, PersonAddAlt1, VerifiedUserOutlined } from '@mui/icons-material';
import useLearningResource from '../../../learning/hooks/useLearningResource';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import { analyticsApi } from '../analyticsApi';
import { exportAnalyticsToExcel } from '../analyticsUtils';

export default function LearnersAnalyticsTab({ onExportReady }) {
  const load = useCallback(async options => ({ data: await analyticsApi.getLearnersAnalytics(options) }), []);
  const { data, loading } = useLearningResource(load, null);

  useEffect(() => {
    if (!onExportReady || !data) return;
    onExportReady(() =>
      exportAnalyticsToExcel(
        [['Tháng đăng ký', 'Tài khoản mới'], ...data.current.series.map(row => [row.label, row.current])],
        'Tai_khoan_moi_theo_thang.xlsx',
        'Tài khoản',
      ),
    );
    return () => onExportReady(null);
  }, [data, onExportReady]);

  if (loading) return <p role="status">Đang tải thống kê học viên...</p>;
  if (!data) return <p role="status">Không tìm thấy dữ liệu học viên.</p>;
  const { current } = data;

  return (
    <div className="analytics-tab-content">
      <p role="status">{data.notice}</p>
      <div className="analytics-stats-grid">
        <StatComparisonCard title="Tổng tài khoản" icon={<PeopleOutlined />} value={current.totalUsers} />
        <StatComparisonCard
          title="Tài khoản đang được bật"
          icon={<VerifiedUserOutlined />}
          value={current.activeUsers}
        />
        <StatComparisonCard
          title="Tài khoản mới trong 7 ngày"
          icon={<PersonAddAlt1 />}
          value={current.newThisWeek}
        />
      </div>
      <div className="analytics-section-card">
        <h3 className="analytics-card-title">Tài khoản đăng ký mới theo tháng</h3>
        <TrendChart series={current.series} compare={false} />
      </div>
    </div>
  );
}
