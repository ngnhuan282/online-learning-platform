import { useState, useEffect } from 'react';
import {
  DiamondOutlined,
  LocalFireDepartment,
  Token,
  WarningAmber,
  TrendingUp,
  TrendingDown,
  School,
  AdminPanelSettings,
} from '@mui/icons-material';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import { analyticsApi } from '../analyticsApi';
import { exportAnalyticsToExcel } from '../analyticsUtils';
import { number } from '../../utils/adminUtils';

export default function GemAnalyticsTab({ range, compare, onExportReady }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsApi
      .getGemAnalytics({
        startDate: range?.startDate,
        endDate: range?.endDate,
      })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [range]);

  // Export handler
  useEffect(() => {
    if (!onExportReady) return;
    onExportReady(async () => {
      if (!data) return;
      const { current, sourceBreakdown, anomalyLog } = data;
      const rows = [
        ['Chỉ số', 'Giá trị'],
        ['Tổng Gem phát hành', current.totalIssued],
        ['Tổng Gem đã tiêu', current.totalSpent],
        ['Gem đang lưu hành', current.totalCirculating],
        ['Phát - Học tập', current.issuedFromLearning],
        ['Phát - Streak', current.issuedFromStreak],
        ['Phát - Admin', current.issuedFromAdmin],
        ['Tiêu - Vật phẩm', current.spentOnItems],
        ['Tiêu - Streak Freeze', current.spentOnStreakFreeze],
        ['Biến động bất thường', current.anomalyCount],
        [],
        ['Nguồn phát hành', 'Gem', '% tổng'],
        ...(sourceBreakdown || []).map((s) => [s.source, s.amount, `${s.percent}%`]),
        [],
        ['Nhật ký biến động bất thường'],
        ['Ngày', 'Loại', 'User ID', 'Tên', 'Gem (±)', 'Lý do'],
        ...(anomalyLog || []).map((a) => [
          a.date, a.type, a.userId, a.userName, a.gemDelta, a.reason,
        ]),
      ];
      await exportAnalyticsToExcel(rows, 'thong-ke-gem.xlsx', 'Thống kê Gem');
    });
  }, [data, onExportReady]);

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="analytics-loading-spinner" />
        <p>Đang tải dữ liệu Gem...</p>
      </div>
    );
  }
  if (!data) {
    return <div className="analytics-error">Không thể tải dữ liệu. Vui lòng thử lại.</div>;
  }

  const { current, previous, sourceBreakdown, anomalyLog } = data;
  const issuedGrowth = previous.totalIssued
    ? (((current.totalIssued - previous.totalIssued) / previous.totalIssued) * 100).toFixed(1)
    : null;
  const spentGrowth = previous.totalSpent
    ? (((current.totalSpent - previous.totalSpent) / previous.totalSpent) * 100).toFixed(1)
    : null;
  const circulatingGrowth = previous.totalCirculating
    ? (((current.totalCirculating - previous.totalCirculating) / previous.totalCirculating) * 100).toFixed(1)
    : null;

  return (
    <div className="analytics-tab-content">
      {/* KPI Cards */}
      <div className="analytics-kpi-grid">
        <StatComparisonCard
          title="Tổng Gem phát hành"
          value={number(current.totalIssued)}
          previousValue={number(previous.totalIssued)}
          growth={issuedGrowth}
          icon={<DiamondOutlined />}
          color="primary"
          suffix="💎"
        />
        <StatComparisonCard
          title="Tổng Gem đã tiêu"
          value={number(current.totalSpent)}
          previousValue={number(previous.totalSpent)}
          growth={spentGrowth}
          icon={<TrendingDown />}
          color="warning"
          suffix="💎"
        />
        <StatComparisonCard
          title="Gem đang lưu hành"
          value={number(current.totalCirculating)}
          previousValue={number(previous.totalCirculating)}
          growth={circulatingGrowth}
          icon={<Token />}
          color="success"
          suffix="💎"
        />
        <StatComparisonCard
          title="Biến động bất thường"
          value={current.anomalyCount}
          previousValue={previous.anomalyCount ?? 0}
          icon={<WarningAmber />}
          color={current.anomalyCount > 0 ? 'error' : 'success'}
          suffix="sự kiện"
        />
      </div>

      {/* Trend Chart */}
      <TrendChart
        title="Xu hướng Gem phát hành theo ngày"
        series={current.series}
        currentLabel="Kỳ này"
        previousLabel="Kỳ trước"
        showComparison={compare}
        unit="💎"
      />

      {/* Source Breakdown + Spend Breakdown */}
      <div className="analytics-two-col">
        {/* Nguồn phát hành */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <TrendingUp className="analytics-card-icon" />
            <h3 className="analytics-card-title">Phân loại nguồn phát hành</h3>
          </div>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Nguồn</th>
                <th style={{ textAlign: 'right' }}>Gem phát</th>
                <th style={{ textAlign: 'right' }}>% tổng</th>
              </tr>
            </thead>
            <tbody>
              {sourceBreakdown.map((s) => (
                <tr key={s.source}>
                  <td>
                    {s.source.includes('bài học') && <School style={{ fontSize: 14, marginRight: 4, color: '#4caf50' }} />}
                    {s.source.includes('Streak') && <LocalFireDepartment style={{ fontSize: 14, marginRight: 4, color: '#ff9800' }} />}
                    {s.source.includes('Admin') && <AdminPanelSettings style={{ fontSize: 14, marginRight: 4, color: '#9c27b0' }} />}
                    {s.source}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {number(s.amount)} 💎
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        background: '#e3f2fd',
                        color: '#1565c0',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {s.percent}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Chi tiêu Gem */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <TrendingDown className="analytics-card-icon" />
            <h3 className="analytics-card-title">Phân loại tiêu dùng Gem</h3>
          </div>
          <div className="analytics-spend-breakdown">
            <div className="analytics-spend-row">
              <span className="analytics-spend-label">🛍️ Mua vật phẩm cửa hàng</span>
              <div className="analytics-spend-bar-wrap">
                <div
                  className="analytics-spend-bar"
                  style={{
                    width: `${((current.spentOnItems / current.totalSpent) * 100).toFixed(0)}%`,
                    background: '#1565c0',
                  }}
                />
              </div>
              <span className="analytics-spend-value">{number(current.spentOnItems)} 💎</span>
              <span className="analytics-spend-pct">
                {((current.spentOnItems / current.totalSpent) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="analytics-spend-row">
              <span className="analytics-spend-label">❄️ Streak Freeze</span>
              <div className="analytics-spend-bar-wrap">
                <div
                  className="analytics-spend-bar"
                  style={{
                    width: `${((current.spentOnStreakFreeze / current.totalSpent) * 100).toFixed(0)}%`,
                    background: '#00acc1',
                  }}
                />
              </div>
              <span className="analytics-spend-value">{number(current.spentOnStreakFreeze)} 💎</span>
              <span className="analytics-spend-pct">
                {((current.spentOnStreakFreeze / current.totalSpent) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: '12px 16px', background: '#f5f5f5', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: '#666' }}>Gem phát / kỳ này</span>
              <strong>{number(current.totalIssued)} 💎</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: '#666' }}>Gem tiêu / kỳ này</span>
              <strong style={{ color: '#d32f2f' }}>−{number(current.totalSpent)} 💎</strong>
            </div>
            <div
              style={{
                borderTop: '1px solid #ddd',
                paddingTop: 6,
                marginTop: 6,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>Lưu hành cuối kỳ</span>
              <strong style={{ color: '#2e7d32' }}>{number(current.totalCirculating)} 💎</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Anomaly Log */}
      {anomalyLog && anomalyLog.length > 0 && (
        <div className="analytics-card" style={{ borderLeft: '4px solid #d32f2f' }}>
          <div className="analytics-card-header">
            <WarningAmber style={{ color: '#d32f2f' }} className="analytics-card-icon" />
            <h3 className="analytics-card-title" style={{ color: '#d32f2f' }}>
              Nhật ký biến động bất thường ({anomalyLog.length})
            </h3>
          </div>
          <div className="analytics-table-wrapper">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Loại</th>
                  <th>User ID</th>
                  <th>Tên người dùng</th>
                  <th style={{ textAlign: 'right' }}>Gem (±)</th>
                  <th>Lý do / Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {anomalyLog.map((a, i) => (
                  <tr key={i}>
                    <td>{a.date}</td>
                    <td>
                      <span
                        style={{
                          background: a.type === 'SPIKE' ? '#ffebee' : '#f3e5f5',
                          color: a.type === 'SPIKE' ? '#c62828' : '#7b1fa2',
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {a.type === 'SPIKE' ? '⚡ SPIKE' : '🔧 ADMIN'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.userId}</td>
                    <td>{a.userName}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#d32f2f' }}>
                      +{number(a.gemDelta)} 💎
                    </td>
                    <td style={{ fontSize: 12, color: '#666' }}>{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
