import { useCallback, useEffect } from 'react';
import useLearningResource from '../../../learning/hooks/useLearningResource';
import {
  AttachMoney,
  AssignmentReturn,
  CheckCircle,
  HourglassEmpty,
  ErrorOutlined,
} from '@mui/icons-material';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import { analyticsApi } from '../analyticsApi';
import { exportAnalyticsToExcel } from '../analyticsUtils';
import { money, number } from '../../utils/adminUtils';

export default function RevenueAnalyticsTab({ onExportReady }) {
  const load = useCallback(async options => ({ data: await analyticsApi.getRevenueAnalytics(options) }), []);
  const { data, loading } = useLearningResource(load, null);

  const handleExport = useCallback(async () => {
    if (!data?.transactions) return;
    const columns = [
      { header: 'Mã GD', accessor: r => r.code || r.orderCode || '—' },
      { header: 'Học viên', accessor: r => r.userName || (r.userId ? `Học viên #${r.userId}` : '—') },
      { header: 'Khóa học / Gói', accessor: r => r.courseTitle || (r.type === 'PRO_SUBSCRIPTION' ? 'Gói Pro VIP' : '—') },
      { header: 'Số tiền (VNĐ)', accessor: r => money(r.amount) },
      { header: 'Trạng thái', accessor: r => r.status === 'SUCCESS' ? 'Thành công' : r.status === 'PENDING' ? 'Chờ thanh toán' : r.status === 'REFUNDED' ? 'Đã hoàn tiền' : 'Thất bại' },
      { header: 'Thời gian', accessor: r => r.date || '—' },
    ];
    const header = columns.map(c => c.header);
    const dataRows = data.transactions.map(row =>
      columns.map(col => (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor])),
    );
    await exportAnalyticsToExcel(
      [header, ...dataRows],
      'Giao_dich_gan_day.xlsx',
      'Doanh thu'
    );
  }, [data]);

  useEffect(() => {
    if (!onExportReady || !data) return;
    onExportReady(handleExport);
    return () => onExportReady(null);
  }, [data, handleExport, onExportReady]);

  if (loading) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Đang tải thống kê doanh thu...</p>;
  }

  if (!data?.current) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Không tìm thấy dữ liệu doanh thu.</p>;
  }

  const { current, transactions } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {data.notice && <p role="status">{data.notice}</p>}
      <div className="analytics-stats-grid">
        <StatComparisonCard
          title="Giá trị thanh toán thành công"
          icon={<AttachMoney />}
          value={current.grossRevenue}
          format="money"
        />
        <StatComparisonCard
          title="Tiền hoàn lại"
          icon={<AssignmentReturn />}
          value={current.refundRevenue}
          format="money"
        />
      </div>

      {/* Biểu đồ xu hướng doanh thu */}
      <div className="analytics-section-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">📈 Xu hướng Doanh thu theo thời gian</h3>
        </div>
        <TrendChart
          series={current.series}
          compare={false}
          currentColor="#2563eb"
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
        </div>

        <div className="analytics-table-wrapper">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng / Học viên</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {transactions && transactions.length > 0 ? (
                transactions.map((txn, idx) => (
                  <tr key={txn.id || txn.code || txn.orderCode || `txn-${idx}`}>
                    <td><strong>{txn.code || txn.orderCode || '—'}</strong></td>
                    <td>
                      <div>
                        <strong>{txn.userName || (txn.userId ? `Học viên #${txn.userId}` : 'Khách vãng lai')}</strong>
                        {txn.courseTitle ? (
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{txn.courseTitle}</div>
                        ) : null}
                      </div>
                    </td>
                    <td><strong>{money(txn.amount)}</strong></td>
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
                    <td style={{ color: '#64748b', fontSize: 12 }}>{txn.date || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
                    Chưa có giao dịch.
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
