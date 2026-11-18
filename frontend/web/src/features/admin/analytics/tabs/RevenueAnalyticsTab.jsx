import { useState, useEffect } from 'react';
import {
  AttachMoney,
  School,
  WorkspacePremium,
  AssignmentReturn,
  CheckCircle,
  HourglassEmpty,
  ErrorOutlined,
} from '@mui/icons-material';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import { analyticsApi } from '../analyticsApi';
import { exportAnalyticsToCsv } from '../analyticsUtils';
import { money, number } from '../../utils/adminUtils';

export default function RevenueAnalyticsTab({ range, compare, onExportReady }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    analyticsApi
      .getRevenueAnalytics({ from: range.from, to: range.to, compare })
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
    if (!data?.transactions) return;
    const columns = [
      { header: 'Mã GD', accessor: 'code' },
      { header: 'Học viên', accessor: 'userName' },
      { header: 'Loại GD', accessor: 'type' },
      { header: 'Số tiền (VNĐ)', accessor: r => money(r.amount) },
      { header: 'Trạng thái', accessor: 'status' },
      { header: 'Thời gian', accessor: 'date' },
    ];
    exportAnalyticsToCsv(`Thong_ke_doanh_thu_${range.from}_${range.to}`, columns, data.transactions);
  };

  useEffect(() => {
    if (onExportReady) {
      onExportReady(() => handleExport);
    }
  }, [data, range]);

  if (loading) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Đang tải thống kê doanh thu...</p>;
  }

  if (!data?.current) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Không tìm thấy dữ liệu doanh thu.</p>;
  }

  const { current, previous, transactions } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 4 Thẻ KPI Doanh thu */}
      <div className="analytics-stats-grid">
        <StatComparisonCard
          title="Doanh thu thuần"
          icon={<AttachMoney />}
          value={current.netRevenue}
          previousValue={previous?.netRevenue}
          format="money"
          compare={compare}
        />
        <StatComparisonCard
          title="Doanh thu Khóa học"
          icon={<School />}
          value={current.courseRevenue}
          previousValue={previous?.courseRevenue}
          format="money"
          compare={compare}
        />
        <StatComparisonCard
          title="Doanh thu Gói Pro"
          icon={<WorkspacePremium />}
          value={current.proRevenue}
          previousValue={previous?.proRevenue}
          format="money"
          compare={compare}
        />
        <StatComparisonCard
          title="Tiền hoàn lại"
          icon={<AssignmentReturn />}
          value={current.refundRevenue}
          previousValue={previous?.refundRevenue}
          format="money"
          compare={compare}
        />
      </div>

      {/* Biểu đồ xu hướng doanh thu */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">📈 Xu hướng Doanh thu theo thời gian</h3>
        </div>
        <TrendChart
          series={current.series}
          compare={compare}
          currentLabel="Kỳ này"
          previousLabel="Kỳ trước"
          currentColor="#2563eb"
          previousColor="#94a3b8"
          valueFormatter={money}
        />
      </div>

      {/* Cơ cấu đơn hàng & Trạng thái thanh toán */}
      <div className="analytics-stats-grid">
        <div className="stat-compare-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div className="stat-card-top">
            <h4 className="stat-card-title">Đơn thành công</h4>
            <CheckCircle style={{ color: '#16a34a' }} />
          </div>
          <div className="stat-card-main">
            <div className="stat-card-value">{number(current.successfulOrders)}</div>
          </div>
          <p className="stat-card-footer">Thanh toán hoàn tất, đã kích hoạt dịch vụ</p>
        </div>

        <div className="stat-compare-card" style={{ borderLeft: '4px solid #ca8a04' }}>
          <div className="stat-card-top">
            <h4 className="stat-card-title">Đơn chờ thanh toán</h4>
            <HourglassEmpty style={{ color: '#ca8a04' }} />
          </div>
          <div className="stat-card-main">
            <div className="stat-card-value">{number(current.pendingOrders)}</div>
          </div>
          <p className="stat-card-footer">Đang đợi xác nhận từ cổng VNPay / VietQR</p>
        </div>

        <div className="stat-compare-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="stat-card-top">
            <h4 className="stat-card-title">Đơn thất bại / Hủy</h4>
            <ErrorOutlined style={{ color: '#dc2626' }} />
          </div>
          <div className="stat-card-main">
            <div className="stat-card-value">{number(current.failedOrders)}</div>
          </div>
          <p className="stat-card-footer">Khách hủy giao dịch hoặc lỗi cổng thanh toán</p>
        </div>
      </div>

      {/* Bảng kê giao dịch gần đây */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">📋 Bảng kê giao dịch trong kỳ</h3>
          <button
            type="button"
            className="button button-soft"
            style={{ fontSize: 13, padding: '4px 12px' }}
            onClick={handleExport}
          >
            Xuất file CSV / Excel
          </button>
        </div>

        <div className="analytics-table-wrapper">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng / Học viên</th>
                <th>Phân loại</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {transactions && transactions.length > 0 ? (
                transactions.map(txn => (
                  <tr key={txn.id || txn.code}>
                    <td><strong>{txn.code}</strong></td>
                    <td>{txn.userName}</td>
                    <td>
                      <span className="badge" style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8' }}>
                        {txn.type === 'PRO_SUBSCRIPTION' ? 'Gói Pro VIP' : txn.type === 'REFUND' ? 'Hoàn tiền' : 'Khóa học lẻ'}
                      </span>
                    </td>
                    <td><strong style={{ color: txn.type === 'REFUND' ? '#dc2626' : '#0f172a' }}>{money(txn.amount)}</strong></td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          fontSize: 11,
                          background: txn.status === 'SUCCESS' ? '#f0fdf4' : txn.status === 'PENDING' ? '#fefce8' : '#fef2f2',
                          color: txn.status === 'SUCCESS' ? '#166534' : txn.status === 'PENDING' ? '#854d0e' : '#991b1b',
                        }}
                      >
                        {txn.status === 'SUCCESS' ? 'Thành công' : txn.status === 'PENDING' ? 'Chờ thanh toán' : txn.status === 'REFUNDED' ? 'Đã hoàn tiền' : 'Thất bại'}
                      </span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>{txn.date}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
                    Không có giao dịch nào trong kỳ này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
