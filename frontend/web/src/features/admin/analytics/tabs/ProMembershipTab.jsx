import { useState, useEffect } from 'react';
import {
  WorkspacePremium,
  CardGiftcard,
  TrendingUp,
  HourglassEmpty,
  PersonAdd,
  Autorenew,
  AdminPanelSettings,
  Paid,
} from '@mui/icons-material';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import { analyticsApi } from '../analyticsApi';
import { exportAnalyticsToCsv } from '../analyticsUtils';
import { number } from '../../utils/adminUtils';

export default function ProMembershipTab({ range, compare, onExportReady }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    analyticsApi
      .getProMembershipAnalytics({ from: range.from, to: range.to, compare })
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
    if (!data?.activationCodes) return;
    const columns = [
      { header: 'Mã Code', accessor: 'code' },
      { header: 'Người kích hoạt', accessor: 'usedBy' },
      { header: 'Phân loại', accessor: r => r.type === 'PAID' ? 'Mua trả phí' : r.type === 'CODE' ? 'Mã kích hoạt' : 'Admin cấp' },
      { header: 'Thời hạn (ngày)', accessor: 'durationDays' },
      { header: 'Trạng thái', accessor: r => r.status === 'ACTIVE' ? 'Đang hoạt động' : r.status === 'EXPIRED' ? 'Hết hạn' : 'Chưa dùng' },
      { header: 'Ngày kích hoạt', accessor: 'activatedAt' },
      { header: 'Hết hạn lúc', accessor: 'expiresAt' },
    ];
    exportAnalyticsToCsv(`Thong_ke_pro_${range.from}_${range.to}`, columns, data.activationCodes);
  };

  useEffect(() => {
    if (onExportReady) onExportReady(() => handleExport);
  }, [data, range]);

  if (loading) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Đang tải thống kê gói Pro...</p>;
  }

  if (!data?.current) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Không tìm thấy dữ liệu gói Pro.</p>;
  }

  const { current, previous, activationCodes, conversionFunnel } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Cards */}
      <div className="analytics-stats-grid">
        <StatComparisonCard
          title="Thành viên Pro đang hoạt động"
          icon={<WorkspacePremium />}
          value={current.activeMembers}
          previousValue={previous?.activeMembers}
          format="number"
          compare={compare}
        />
        <StatComparisonCard
          title="Mới gia nhập kỳ này"
          icon={<PersonAdd />}
          value={current.newMembers}
          previousValue={previous?.newMembers}
          format="number"
          compare={compare}
        />
        <StatComparisonCard
          title="Gia hạn trong kỳ"
          icon={<Autorenew />}
          value={current.renewals}
          previousValue={previous?.renewals}
          format="number"
          compare={compare}
        />
        <StatComparisonCard
          title="Tỷ lệ Free → Pro"
          icon={<TrendingUp />}
          value={current.conversionRate}
          previousValue={previous?.conversionRate}
          format="percent"
          compare={compare}
        />
      </div>

      {/* Phân loại trạng thái thành viên */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">👑 Phân loại trạng thái thành viên Pro</h3>
        </div>
        <div className="analytics-stats-grid">
          <div className="stat-compare-card" style={{ borderLeft: '4px solid #16a34a' }}>
            <div className="stat-card-top">
              <h4 className="stat-card-title">Còn hạn sử dụng</h4>
              <WorkspacePremium style={{ color: '#16a34a' }} />
            </div>
            <div className="stat-card-main">
              <div className="stat-card-value">{number(current.activeMembers)}</div>
            </div>
            <p className="stat-card-footer">Thành viên đang có quyền truy cập toàn bộ nội dung Pro</p>
          </div>
          <div className="stat-compare-card" style={{ borderLeft: '4px solid #ca8a04' }}>
            <div className="stat-card-top">
              <h4 className="stat-card-title">Sắp hết hạn (≤7 ngày)</h4>
              <HourglassEmpty style={{ color: '#ca8a04' }} />
            </div>
            <div className="stat-card-main">
              <div className="stat-card-value">{number(current.expiringMembers)}</div>
            </div>
            <p className="stat-card-footer">Cần gửi nhắc nhở để khuyến khích gia hạn</p>
          </div>
          <div className="stat-compare-card" style={{ borderLeft: '4px solid #dc2626' }}>
            <div className="stat-card-top">
              <h4 className="stat-card-title">Đã hết hạn trong kỳ</h4>
              <span style={{ fontSize: 20 }}>⚠️</span>
            </div>
            <div className="stat-card-main">
              <div className="stat-card-value">{number(current.expiredMembers)}</div>
            </div>
            <p className="stat-card-footer">Tài khoản đã về gói miễn phí, có thể tái thu hút</p>
          </div>
        </div>
      </div>

      {/* Phân loại nguồn gốc Pro */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">📊 Phân loại nguồn gốc gói Pro (ảnh hưởng tới doanh thu)</h3>
        </div>
        <div className="analytics-stats-grid">
          <div className="stat-compare-card">
            <div className="stat-card-top">
              <h4 className="stat-card-title">Mua trả phí (VNPay / QR)</h4>
              <Paid style={{ color: '#2563eb' }} />
            </div>
            <div className="stat-card-main">
              <div className="stat-card-value">{number(current.paidSource)}</div>
              <span className="stat-growth-badge is-up">{current.paidPercent}%</span>
            </div>
            <p className="stat-card-footer">Đóng góp trực tiếp vào doanh thu cổng thanh toán</p>
          </div>
          <div className="stat-compare-card">
            <div className="stat-card-top">
              <h4 className="stat-card-title">Dùng mã kích hoạt</h4>
              <CardGiftcard style={{ color: '#8b5cf6' }} />
            </div>
            <div className="stat-card-main">
              <div className="stat-card-value">{number(current.codeSource)}</div>
              <span className="stat-growth-badge is-neutral">{current.codePercent}%</span>
            </div>
            <p className="stat-card-footer">Từ chiến dịch khuyến mãi, đại lý hoặc học bổng</p>
          </div>
          <div className="stat-compare-card">
            <div className="stat-card-top">
              <h4 className="stat-card-title">Admin cấp thủ công</h4>
              <AdminPanelSettings style={{ color: '#64748b' }} />
            </div>
            <div className="stat-card-main">
              <div className="stat-card-value">{number(current.adminSource)}</div>
              <span className="stat-growth-badge is-neutral">{current.adminPercent}%</span>
            </div>
            <p className="stat-card-footer">Tặng thưởng, beta testers — không tính doanh thu</p>
          </div>
        </div>
      </div>

      {/* Biểu đồ tăng trưởng thành viên Pro */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">📈 Xu hướng tăng trưởng thành viên Pro</h3>
        </div>
        <TrendChart
          series={current.series}
          compare={compare}
          currentLabel="Kỳ này"
          previousLabel="Kỳ trước"
          currentColor="#7c3aed"
          previousColor="#94a3b8"
          valueFormatter={number}
        />
      </div>

      {/* Bảng mã kích hoạt */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">🎁 Bảng kê mã kích hoạt Pro đã sử dụng</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              Phân biệt rõ nguồn mua / mã code / admin cấp để tính doanh thu chính xác
            </p>
          </div>
          <button
            type="button"
            className="button button-soft"
            style={{ fontSize: 13, padding: '4px 12px' }}
            onClick={handleExport}
          >
            Xuất Excel
          </button>
        </div>
        <div className="analytics-table-wrapper">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Mã Code</th>
                <th>Người kích hoạt</th>
                <th>Phân loại</th>
                <th>Thời hạn</th>
                <th>Trạng thái</th>
                <th>Kích hoạt lúc</th>
                <th>Hết hạn lúc</th>
              </tr>
            </thead>
            <tbody>
              {activationCodes?.map(code => (
                <tr key={code.code}>
                  <td><strong style={{ fontFamily: 'monospace', fontSize: 13 }}>{code.code}</strong></td>
                  <td>
                    <div>{code.usedBy}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{code.email}</div>
                  </td>
                  <td>
                    <span className="badge" style={{
                      fontSize: 11,
                      background: code.type === 'PAID' ? '#eff6ff' : code.type === 'CODE' ? '#faf5ff' : '#f8fafc',
                      color: code.type === 'PAID' ? '#1d4ed8' : code.type === 'CODE' ? '#7c3aed' : '#475569',
                    }}>
                      {code.type === 'PAID' ? '💳 Mua trả phí' : code.type === 'CODE' ? '🎁 Mã code' : '🛡️ Admin cấp'}
                    </span>
                  </td>
                  <td>{code.durationDays} ngày</td>
                  <td>
                    <span className="badge" style={{
                      fontSize: 11,
                      background: code.status === 'ACTIVE' ? '#f0fdf4' : code.status === 'EXPIRED' ? '#fef2f2' : '#fefce8',
                      color: code.status === 'ACTIVE' ? '#166534' : code.status === 'EXPIRED' ? '#991b1b' : '#854d0e',
                    }}>
                      {code.status === 'ACTIVE' ? '✅ Đang hoạt động' : code.status === 'EXPIRED' ? '❌ Hết hạn' : '⏳ Sắp hết hạn'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{code.activatedAt}</td>
                  <td style={{ fontSize: 12, color: code.status === 'EXPIRED' ? '#dc2626' : '#64748b' }}>{code.expiresAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
