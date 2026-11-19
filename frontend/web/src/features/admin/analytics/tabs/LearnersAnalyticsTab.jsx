import { useCallback, useEffect } from 'react';
import {
  LockOutlined,
  PeopleOutlined,
  PersonAddAlt1,
  ShowChartOutlined,
  VerifiedUserOutlined,
} from '@mui/icons-material';
import useLearningResource from '../../../learning/hooks/useLearningResource';
import { LoadState } from '../../components/AdminUi';
import { CommerceTable } from '../../components/CommerceAdminUi';
import BreakdownDonut from '../../components/analytics/BreakdownDonut';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import useAdminPagination from '../../hooks/useAdminPagination';
import { number } from '../../utils/adminUtils';
import { analyticsApi } from '../analyticsApi';
import { exportAnalyticsToExcel } from '../analyticsUtils';

export default function LearnersAnalyticsTab({ onExportReady }) {
  const load = useCallback(async options => ({ data: await analyticsApi.getLearnersAnalytics(options) }), []);
  const { data, loading, error, reload } = useLearningResource(load, null);
  const tablePagination = useAdminPagination(10);

  useEffect(() => {
    if (!onExportReady || !data) return;
    onExportReady(() =>
      exportAnalyticsToExcel(
        [
          ['Chỉ số tài khoản', 'Giá trị'],
          ['Tổng tài khoản', data.current.totalUsers],
          ['Đang hoạt động', data.current.activeUsers],
          ['Đang bị khóa', data.current.lockedUsers],
          ['Vô hiệu hóa', data.current.disabledUsers],
          ['Tài khoản mới 7 ngày', data.current.newThisWeek],
          [],
          ['Tháng đăng ký', 'Tài khoản mới'],
          ...data.current.series.map(row => [row.label, row.current]),
        ],
        'Tai_khoan_moi_theo_thang.xlsx',
        'Tài khoản',
      ),
    );
    return () => onExportReady(null);
  }, [data, onExportReady]);

  if (loading || error) {
    return <LoadState loading={loading} error={error} retry={reload} />;
  }
  if (!data) {
    return <p className="analytics-chart-empty">Không tìm thấy dữ liệu học viên.</p>;
  }

  const { current } = data;
  const inactiveTotal = (current.lockedUsers ?? 0) + (current.disabledUsers ?? 0);
  const activeRate =
    current.totalUsers > 0 ? Math.round((current.activeUsers / current.totalUsers) * 1000) / 10 : 0;

  const statusItems = [
    { label: 'Đang hoạt động', value: current.activeUsers, color: '#16a34a' },
    { label: 'Đang bị khóa', value: current.lockedUsers, color: '#f59e0b' },
    { label: 'Đã vô hiệu hóa', value: current.disabledUsers, color: '#ef4444' },
  ];

  const monthlyTotal = current.series.reduce((sum, item) => sum + item.current, 0);
  const monthlyRows = [...current.series].reverse().map((row, idx, arr) => {
    const prev = arr[idx + 1]?.current;
    return {
      id: row.rawMonth || row.label,
      label: row.label,
      count: row.current,
      share: monthlyTotal > 0 ? Math.round((row.current / monthlyTotal) * 1000) / 10 : 0,
      diff: prev == null ? null : row.current - prev,
    };
  });

  return (
    <div className="analytics-tab-content">
      {data.notice && (
        <div className="analytics-notice-bar" role="status">
          <span>{data.notice}</span>
        </div>
      )}

      <div className="analytics-stats-grid">
        <StatComparisonCard
          title="Tổng tài khoản"
          icon={<PeopleOutlined />}
          value={current.totalUsers}
          tone="blue"
          helper="Tài khoản chưa xóa mềm trong hệ thống"
        />
        <StatComparisonCard
          title="Tài khoản đang được bật"
          icon={<VerifiedUserOutlined />}
          value={current.activeUsers}
          tone="green"
          helper={`Chiếm ${activeRate}% tổng số tài khoản`}
        />
        <StatComparisonCard
          title="Tài khoản mới trong 7 ngày"
          icon={<PersonAddAlt1 />}
          value={current.newThisWeek}
          tone="cyan"
          helper="Đăng ký mới trong 7 ngày gần nhất"
        />
        <StatComparisonCard
          title="Khóa / Vô hiệu hóa"
          icon={<LockOutlined />}
          value={inactiveTotal}
          tone="amber"
          helper={`${number(current.lockedUsers)} đang khóa · ${number(current.disabledUsers)} vô hiệu`}
        />
      </div>

      <div className="analytics-two-col">
        <section className="analytics-section-card">
          <div className="analytics-card-header">
            <div>
              <h3 className="analytics-card-title">
                <ShowChartOutlined fontSize="small" /> Tài khoản đăng ký mới theo tháng
              </h3>
              <p className="analytics-card-subtitle">6 tháng gần nhất (múi giờ UTC)</p>
            </div>
          </div>
          <TrendChart
            series={current.series}
            compare={false}
            currentLabel="Tài khoản mới"
            currentColor="#0ea5e9"
          />
        </section>

        <section className="analytics-section-card">
          <div className="analytics-card-header">
            <div>
              <h3 className="analytics-card-title">
                <VerifiedUserOutlined fontSize="small" /> Phân bố trạng thái tài khoản
              </h3>
              <p className="analytics-card-subtitle">Tình trạng hoạt động hiện tại của toàn bộ tài khoản</p>
            </div>
          </div>
          <BreakdownDonut
            items={statusItems}
            centerLabel="TÀI KHOẢN"
            centerValue={number(current.totalUsers)}
            emptyMessage="Chưa có dữ liệu trạng thái tài khoản."
          />
        </section>
      </div>

      <section className="analytics-section-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Chi tiết đăng ký theo tháng</h3>
            <p className="analytics-card-subtitle">So sánh tăng trưởng giữa các tháng gần nhất</p>
          </div>
        </div>
        <CommerceTable
          embedded
          paginate
          pagination={tablePagination}
          rowKey="id"
          rows={monthlyRows}
          emptyMessage="Chưa có dữ liệu theo tháng."
          columns={[
            ['Tháng', row => <strong>{row.label}</strong>],
            ['Tài khoản mới', row => number(row.count)],
            ['Tỷ trọng (6 tháng)', row => `${row.share}%`],
            [
              'So với tháng trước',
              row => {
                if (row.diff == null) return '—';
                const tone = row.diff > 0 ? 'green' : row.diff < 0 ? 'red' : '';
                const prefix = row.diff > 0 ? '+' : '';
                return <span className={`admin-pill ${tone}`}>{`${prefix}${number(row.diff)}`}</span>;
              },
            ],
          ]}
        />
      </section>
    </div>
  );
}
