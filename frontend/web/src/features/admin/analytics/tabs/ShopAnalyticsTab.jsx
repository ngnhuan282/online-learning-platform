import { useState, useEffect } from 'react';
import {
  StorefrontOutlined,
  ShoppingCart,
  LocalFireDepartment,
  PeopleOutlined,
  TrendingUp,
} from '@mui/icons-material';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import { analyticsApi } from '../analyticsApi';
import { exportAnalyticsToCsv } from '../analyticsUtils';
import { number } from '../../utils/adminUtils';

export default function ShopAnalyticsTab({ range, compare, onExportReady }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsApi
      .getShopAnalytics({
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
    onExportReady(() => {
      if (!data) return;
      const { current, topItems } = data;
      const rows = [
        ['Chỉ số', 'Giá trị'],
        ['Tổng lượt mua', current.totalPurchases],
        ['Tổng Gem tiêu', current.totalGemSpent],
        ['Người mua duy nhất', current.uniqueBuyers],
        ['Tỷ lệ trang bị TB (%)', current.avgEquipRate],
        ['Streak Freeze đã mua', current.streakFreezePurchased],
        ['Streak Freeze đã dùng', current.streakFreezeUsed],
        [],
        ['ID', 'Vật phẩm', 'Danh mục', 'Lượt mua', 'Gem/item', 'Tổng Gem tiêu', 'Số người sở hữu', 'Tỷ lệ trang bị (%)'],
        ...(topItems || []).map((item) => [
          item.id, item.name, item.category, item.purchases,
          item.gemCost, item.totalGemSpent, item.owners, `${item.equipRate}%`,
        ]),
      ];
      exportAnalyticsToCsv(rows, 'thong-ke-cua-hang.csv');
    });
  }, [data, onExportReady]);

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="analytics-loading-spinner" />
        <p>Đang tải dữ liệu Cửa hàng...</p>
      </div>
    );
  }
  if (!data) {
    return <div className="analytics-error">Không thể tải dữ liệu. Vui lòng thử lại.</div>;
  }

  const { current, previous, topItems } = data;

  const purchasesGrowth = previous.totalPurchases
    ? (((current.totalPurchases - previous.totalPurchases) / previous.totalPurchases) * 100).toFixed(1)
    : null;
  const gemGrowth = previous.totalGemSpent
    ? (((current.totalGemSpent - previous.totalGemSpent) / previous.totalGemSpent) * 100).toFixed(1)
    : null;
  const buyersGrowth = previous.uniqueBuyers
    ? (((current.uniqueBuyers - previous.uniqueBuyers) / previous.uniqueBuyers) * 100).toFixed(1)
    : null;
  const equipGrowth = previous.avgEquipRate
    ? (current.avgEquipRate - previous.avgEquipRate).toFixed(1)
    : null;

  const streakFreezeRate = current.streakFreezePurchased > 0
    ? ((current.streakFreezeUsed / current.streakFreezePurchased) * 100).toFixed(1)
    : 0;

  return (
    <div className="analytics-tab-content">
      {/* KPI Cards */}
      <div className="analytics-kpi-grid">
        <StatComparisonCard
          title="Tổng lượt mua vật phẩm"
          value={number(current.totalPurchases)}
          previousValue={number(previous.totalPurchases)}
          growth={purchasesGrowth}
          icon={<ShoppingCart />}
          color="primary"
          suffix="lượt"
        />
        <StatComparisonCard
          title="Tổng Gem tiêu tại cửa hàng"
          value={number(current.totalGemSpent)}
          previousValue={number(previous.totalGemSpent)}
          growth={gemGrowth}
          icon={<StorefrontOutlined />}
          color="warning"
          suffix="💎"
        />
        <StatComparisonCard
          title="Người mua duy nhất"
          value={number(current.uniqueBuyers)}
          previousValue={number(previous.uniqueBuyers)}
          growth={buyersGrowth}
          icon={<PeopleOutlined />}
          color="info"
          suffix="học viên"
        />
        <StatComparisonCard
          title="Tỷ lệ trang bị trung bình"
          value={`${current.avgEquipRate}%`}
          previousValue={`${previous.avgEquipRate}%`}
          growth={equipGrowth}
          icon={<TrendingUp />}
          color="success"
        />
      </div>

      {/* Streak Freeze Card + Trend Chart */}
      <div className="analytics-two-col">
        {/* Streak Freeze summary */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <LocalFireDepartment className="analytics-card-icon" style={{ color: '#ff7043' }} />
            <h3 className="analytics-card-title">Streak Freeze ❄️</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#e8f5e9',
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 13, color: '#388e3c' }}>Đã mua trong kỳ</span>
              <strong style={{ color: '#1b5e20' }}>{current.streakFreezePurchased} cái</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#fff3e0',
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 13, color: '#e65100' }}>Đã sử dụng</span>
              <strong style={{ color: '#bf360c' }}>{current.streakFreezeUsed} cái</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#f3e5f5',
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 13, color: '#7b1fa2' }}>Chưa sử dụng (tồn kho)</span>
              <strong style={{ color: '#4a148c' }}>
                {current.streakFreezePurchased - current.streakFreezeUsed} cái
              </strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#e3f2fd',
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 13, color: '#1565c0' }}>Tỷ lệ tiêu hao</span>
              <strong style={{ color: '#0d47a1', fontSize: 18 }}>
                {streakFreezeRate}%
              </strong>
            </div>
          </div>
        </div>

        {/* Trend Chart inline */}
        <TrendChart
          title="Lượt mua vật phẩm theo ngày"
          series={current.series}
          currentLabel="Kỳ này"
          previousLabel="Kỳ trước"
          showComparison={compare}
          unit="lượt"
        />
      </div>

      {/* Top Items Table */}
      <div className="analytics-card">
        <div className="analytics-card-header">
          <ShoppingCart className="analytics-card-icon" />
          <h3 className="analytics-card-title">Vật phẩm bán chạy nhất</h3>
        </div>
        <div className="analytics-table-wrapper">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Vật phẩm</th>
                <th>Danh mục</th>
                <th style={{ textAlign: 'right' }}>Lượt mua</th>
                <th style={{ textAlign: 'right' }}>Gem/item</th>
                <th style={{ textAlign: 'right' }}>Tổng Gem tiêu</th>
                <th style={{ textAlign: 'right' }}>Số người sở hữu</th>
                <th style={{ textAlign: 'right' }}>Tỷ lệ trang bị</th>
              </tr>
            </thead>
            <tbody>
              {topItems.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ color: '#888', fontWeight: 700 }}>{idx + 1}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                  </td>
                  <td>
                    <span
                      style={{
                        background:
                          item.category === 'Streak'
                            ? '#fff3e0'
                            : item.category === 'Avatar'
                              ? '#e3f2fd'
                              : item.category === 'Badge'
                                ? '#f3e5f5'
                                : '#e8f5e9',
                        color:
                          item.category === 'Streak'
                            ? '#e65100'
                            : item.category === 'Avatar'
                              ? '#1565c0'
                              : item.category === 'Badge'
                                ? '#7b1fa2'
                                : '#2e7d32',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {item.category}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{number(item.purchases)}</td>
                  <td style={{ textAlign: 'right' }}>{item.gemCost} 💎</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{number(item.totalGemSpent)} 💎</td>
                  <td style={{ textAlign: 'right' }}>{number(item.owners)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: item.equipRate >= 80 ? '#2e7d32' : item.equipRate >= 50 ? '#e65100' : '#c62828',
                      }}
                    >
                      {item.equipRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f5f5f5' }}>
                <td colSpan={3} style={{ fontWeight: 700, padding: '8px 12px' }}>
                  Tổng cộng
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                  {number(topItems.reduce((s, i) => s + i.purchases, 0))}
                </td>
                <td />
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                  {number(topItems.reduce((s, i) => s + i.totalGemSpent, 0))} 💎
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
