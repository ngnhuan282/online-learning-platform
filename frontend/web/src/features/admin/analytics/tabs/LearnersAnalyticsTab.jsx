import { useState, useEffect } from 'react';
import {
  PersonAddAlt1,
  PeopleOutlined,
  Loop,
  PersonOffOutlined,
  CalendarMonth,
  DateRange,
  Today,
} from '@mui/icons-material';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import { analyticsApi } from '../analyticsApi';
import { exportAnalyticsToCsv } from '../analyticsUtils';
import { number } from '../../utils/adminUtils';

export default function LearnersAnalyticsTab({ range, compare, onExportReady }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    analyticsApi
      .getLearnersAnalytics({ from: range.from, to: range.to, compare })
      .then(res => {
        if (active) setData(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range, compare]);

  const handleExport = () => {
    if (!data?.current?.series) return;
    const columns = [
      { header: 'Kỳ / Tháng', accessor: 'label' },
      { header: 'Học viên mới kỳ này', accessor: 'current' },
      { header: 'Học viên mới kỳ trước', accessor: 'previous' },
    ];
    exportAnalyticsToCsv(`Thong_ke_hoc_vien_${range.from}_${range.to}`, columns, data.current.series);
  };

  useEffect(() => {
    if (onExportReady) {
      onExportReady(() => handleExport);
    }
  }, [data, range]);

  if (loading) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Đang tải thống kê học viên...</p>;
  }

  if (!data?.current) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Không tìm thấy dữ liệu học viên.</p>;
  }

  const { current, previous } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 4 Thẻ KPI Học viên */}
      <div className="analytics-stats-grid">
        <StatComparisonCard
          title="Học viên mới"
          icon={<PersonAddAlt1 />}
          value={current.newLearners}
          previousValue={previous?.newLearners}
          format="number"
          compare={compare}
        />
        <StatComparisonCard
          title="Người dùng hoạt động (MAU)"
          icon={<PeopleOutlined />}
          value={current.activeLearnersMau}
          previousValue={previous?.activeUsers}
          format="number"
          compare={compare}
        />
        <StatComparisonCard
          title="Tỷ lệ quay lại"
          icon={<Loop />}
          value={current.retentionRate}
          previousValue={previous?.retentionRate}
          format="percent"
          compare={compare}
        />
        <StatComparisonCard
          title="Học viên ngừng học"
          icon={<PersonOffOutlined />}
          value={current.churnCount}
          previousValue={previous?.churnCount}
          format="number"
          compare={compare}
          subtitle={`Kỳ trước: ${number(previous?.churnCount)} học viên`}
        />
      </div>

      {/* Biểu đồ xu hướng tăng trưởng người dùng */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">👥 Tăng trưởng tài khoản đăng ký mới</h3>
        </div>
        <TrendChart
          series={current.series}
          compare={compare}
          currentLabel="Kỳ này"
          previousLabel="Kỳ trước"
          currentColor="#3b82f6"
          previousColor="#94a3b8"
          valueFormatter={number}
        />
      </div>

      {/* Chỉ số DAU - WAU - MAU */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">📊 Người dùng học tập hoạt động tích cực (Active Learners)</h3>
        </div>

        <div className="analytics-stats-grid">
          <div className="stat-compare-card">
            <div className="stat-card-top">
              <h4 className="stat-card-title">DAU (Hàng ngày)</h4>
              <Today style={{ color: '#0ea5e9' }} />
            </div>
            <div className="stat-card-main">
              <div className="stat-card-value">{number(current.activeLearnersDau)}</div>
            </div>
            <p className="stat-card-footer">Số học viên đăng nhập & có tiến độ học tập trong ngày</p>
          </div>

          <div className="stat-compare-card">
            <div className="stat-card-top">
              <h4 className="stat-card-title">WAU (Hàng tuần)</h4>
              <DateRange style={{ color: '#8b5cf6' }} />
            </div>
            <div className="stat-card-main">
              <div className="stat-card-value">{number(current.activeLearnersWau)}</div>
            </div>
            <p className="stat-card-footer">Học viên duy trì streak học ít nhất 1 lần trong 7 ngày</p>
          </div>

          <div className="stat-compare-card">
            <div className="stat-card-top">
              <h4 className="stat-card-title">MAU (Hàng tháng)</h4>
              <CalendarMonth style={{ color: '#10b981' }} />
            </div>
            <div className="stat-card-main">
              <div className="stat-card-value">{number(current.activeLearnersMau)}</div>
            </div>
            <p className="stat-card-footer">Học viên hoạt động và hoàn thành bài giảng trong 30 ngày</p>
          </div>
        </div>
      </div>
    </div>
  );
}
