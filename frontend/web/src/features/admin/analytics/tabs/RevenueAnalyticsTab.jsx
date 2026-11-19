import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, MenuItem, TextField } from '@mui/material';
import {
  AttachMoney,
  AssignmentReturn,
  CheckCircle,
  ErrorOutlined,
  HourglassEmpty,
  ReceiptLongOutlined,
  Refresh,
  SchoolOutlined,
  ShowChartOutlined,
} from '@mui/icons-material';
import useLearningResource from '../../../learning/hooks/useLearningResource';
import { getPaymentDisplayStatus } from '../../../payment/utils/paymentFlow';
import { LoadState } from '../../components/AdminUi';
import { CommercePager, CommerceTable } from '../../components/CommerceAdminUi';
import BreakdownDonut from '../../components/analytics/BreakdownDonut';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import useAdminPagination from '../../hooks/useAdminPagination';
import { adminApi } from '../../api/adminApi';
import { date, money, number } from '../../utils/adminUtils';
import { analyticsApi } from '../analyticsApi';
import { exportAnalyticsToExcel } from '../analyticsUtils';

const statusMeta = {
  SUCCESS: { label: 'Thành công', tone: 'green' },
  PENDING: { label: 'Chờ thanh toán', tone: 'amber' },
  EXPIRED: { label: 'Hết hạn thanh toán', tone: 'amber' },
  FAILED: { label: 'Thất bại', tone: 'red' },
  CANCELLED: { label: 'Đã hủy', tone: 'red' },
  REFUNDED: { label: 'Đã hoàn tiền', tone: 'purple' },
};

const statusOptions = [
  ['ALL', 'Tất cả trạng thái'],
  ['SUCCESS', 'Thành công'],
  ['PENDING', 'Chờ thanh toán'],
  ['EXPIRED', 'Hết hạn thanh toán'],
  ['FAILED', 'Thất bại'],
  ['CANCELLED', 'Đã hủy'],
  ['REFUNDED', 'Đã hoàn tiền'],
];

function displayStatus(txn) {
  return getPaymentDisplayStatus({
    status: txn.status ?? txn.paymentStatus,
    paymentStatus: txn.paymentStatus ?? txn.status,
    orderStatus: txn.orderStatus,
    expiresAt: txn.expiresAt,
  });
}

function formatAmount(amount, currency = 'VND') {
  if (!currency || currency === 'VND') return money(amount);
  return `${number(amount)} ${currency}`;
}

export default function RevenueAnalyticsTab({ onExportReady }) {
  const load = useCallback(async options => ({ data: await analyticsApi.getRevenueAnalytics(options) }), []);
  const { data, loading, error, reload } = useLearningResource(load, null);

  const [mode, setMode] = useState('recent');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');

  const recentPagination = useAdminPagination(10);
  const serverPagination = useAdminPagination(10);

  const loadServerOrders = useCallback(
    async options => {
      if (mode !== 'server') return { data: null };
      const params = {
        page: serverPagination.page,
        size: serverPagination.size,
      };
      if (statusFilter === 'EXPIRED') {
        params.expired = true;
      } else if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (keyword.trim()) {
        params.keyword = keyword.trim();
      }
      const response = await adminApi.paymentOrders(params, options);
      return { data: response.data };
    },
    [mode, serverPagination.page, serverPagination.size, statusFilter, keyword],
  );

  const serverResource = useLearningResource(loadServerOrders, null);

  const filteredRecent = useMemo(() => {
    const items = data?.transactions ?? [];
    return items.filter(txn => {
      const effectiveStatus = displayStatus(txn);
      if (statusFilter !== 'ALL' && effectiveStatus !== statusFilter) return false;
      if (!keyword.trim()) return true;
      const needle = keyword.trim().toLowerCase();
      return (
        String(txn.code ?? txn.orderCode ?? '').toLowerCase().includes(needle) ||
        String(txn.courseTitle ?? '').toLowerCase().includes(needle) ||
        String(txn.userName ?? txn.userId ?? '').toLowerCase().includes(needle)
      );
    });
  }, [data?.transactions, statusFilter, keyword]);

  const activeRows = useMemo(() => {
    if (mode === 'server') {
      return (serverResource.data?.content ?? []).map(item => ({
        ...item,
        id: item.orderCode,
        code: item.orderCode,
        status: item.paymentStatus ?? item.status,
        userName: `Học viên #${item.userId}`,
        date: item.createdAt,
      }));
    }
    return filteredRecent;
  }, [mode, serverResource.data, filteredRecent]);

  const handleExport = useCallback(async () => {
    if (!data?.current) return;
    const rowsToExport = mode === 'server' ? activeRows : data.transactions ?? [];
    const columns = [
      { header: 'Mã đơn', accessor: r => r.code || r.orderCode || '—' },
      { header: 'Học viên', accessor: r => r.userName || (r.userId ? `Học viên #${r.userId}` : '—') },
      { header: 'Khóa học / Gói', accessor: r => r.courseTitle || '—' },
      { header: 'Số tiền', accessor: r => formatAmount(r.amount, r.currency) },
      { header: 'Cổng thanh toán', accessor: r => r.provider || '—' },
      {
        header: 'Trạng thái',
        accessor: r => {
          const code = displayStatus(r);
          return statusMeta[code]?.label || code || '—';
        },
      },
      { header: 'Thời gian', accessor: r => (r.date ? date(r.date) : '—') },
    ];
    const header = columns.map(c => c.header);
    const dataRows = rowsToExport.map(row =>
      columns.map(col => (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor])),
    );
    await exportAnalyticsToExcel(
      [
        ['Tổng quan Doanh thu & Thanh toán', 'Giá trị'],
        ['Doanh thu thành công', money(data.current.grossRevenue)],
        ['Tiền đang chờ thanh toán', money(data.current.pendingAmount)],
        ['Tiền hoàn lại', money(data.current.refundRevenue)],
        ['Tổng đơn hàng', data.current.totalOrders],
        ['Đơn thành công', data.current.successfulOrders],
        ['Đơn chờ thanh toán', data.current.pendingOrders],
        ['Đơn thất bại / hủy', data.current.failedOrders],
        [],
        header,
        ...dataRows,
      ],
      'Thong_ke_doanh_thu.xlsx',
      'Doanh thu',
    );
  }, [data, mode, activeRows]);

  useEffect(() => {
    if (!onExportReady || !data) return;
    onExportReady(handleExport);
    return () => onExportReady(null);
  }, [data, handleExport, onExportReady]);

  if (loading || error) {
    return <LoadState loading={loading} error={error} retry={reload} />;
  }

  if (!data?.current) {
    return <p className="analytics-chart-empty">Không tìm thấy dữ liệu doanh thu.</p>;
  }

  const { current } = data;
  const totalCounted =
    (current.successfulOrders ?? 0) + (current.pendingOrders ?? 0) + (current.failedOrders ?? 0);
  const denominator = current.totalOrders > 0 ? current.totalOrders : totalCounted;
  const successRate =
    denominator > 0 ? Math.round(((current.successfulOrders ?? 0) / denominator) * 1000) / 10 : 0;

  const statusBreakdown = [
    { label: 'Thành công', value: current.successfulOrders ?? 0, color: '#16a34a' },
    { label: 'Chờ thanh toán', value: current.pendingOrders ?? 0, color: '#f59e0b' },
    { label: 'Thất bại / Hủy', value: current.failedOrders ?? 0, color: '#ef4444' },
  ];

  const transactionColumns = [
    [
      'Mã đơn',
      txn => (
        <Link className="admin-link-strong" to={`/admin/payments/${txn.code || txn.orderCode}`}>
          {txn.code || txn.orderCode || '—'}
        </Link>
      ),
    ],
    [
      'Học viên & Nội dung',
      txn => (
        <div>
          <strong>{txn.userName || (txn.userId ? `Học viên #${txn.userId}` : '—')}</strong>
          {txn.courseTitle ? <small>{txn.courseTitle}</small> : null}
        </div>
      ),
    ],
    ['Số tiền', txn => <strong>{formatAmount(txn.amount, txn.currency)}</strong>],
    ['Cổng', txn => <span className="admin-pill">{txn.provider || '—'}</span>],
    [
      'Trạng thái',
      txn => {
        const code = displayStatus(txn);
        const meta = statusMeta[code] || { label: code || '—', tone: 'amber' };
        return <span className={`admin-pill ${meta.tone}`}>{meta.label}</span>;
      },
    ],
    ['Thời gian', txn => (txn.date ? date(txn.date) : '—')],
  ];

  return (
    <div className="analytics-tab-content">
      {data.notice && (
        <div className="analytics-notice-bar" role="status">
          <span>{data.notice}</span>
          {data.generatedAt && (
            <small>Cập nhật: {date(data.generatedAt)}</small>
          )}
        </div>
      )}

      <div className="analytics-stats-grid">
        <StatComparisonCard
          title="Giá trị thanh toán thành công"
          icon={<AttachMoney />}
          value={current.grossRevenue}
          format="money"
          tone="green"
          helper={`${number(current.successfulOrders)} đơn đã hoàn tất`}
        />
        <StatComparisonCard
          title="Tiền đang chờ thanh toán"
          icon={<HourglassEmpty />}
          value={current.pendingAmount}
          format="money"
          tone="amber"
          helper={`${number(current.pendingOrders)} đơn đang chờ VNPay / VietQR`}
        />
        <StatComparisonCard
          title="Tiền hoàn lại"
          icon={<AssignmentReturn />}
          value={current.refundRevenue}
          format="money"
          tone="red"
          helper={`${number(current.failedOrders)} đơn thất bại hoặc đã hủy`}
        />
        <StatComparisonCard
          title="Tỷ lệ đơn thành công"
          icon={<CheckCircle />}
          value={successRate}
          format="percent"
          tone="blue"
          helper={`${number(current.successfulOrders)} / ${number(denominator)} tổng đơn`}
        />
        <StatComparisonCard
          title="Học viên đã giao dịch"
          icon={<SchoolOutlined />}
          value={current.crossService?.activeLearners ?? 0}
          tone="purple"
          helper={`${number(current.crossService?.paidCourses ?? 0)} khóa học · ${number(current.crossService?.enrollmentReady ?? current.successfulOrders)} kích hoạt`}
        />
      </div>

      <div className="analytics-two-col">
        <section className="analytics-section-card">
          <div className="analytics-card-header">
            <div>
              <h3 className="analytics-card-title">
                <ShowChartOutlined fontSize="small" /> Xu hướng doanh thu 6 ngày gần nhất
              </h3>
              <p className="analytics-card-subtitle">Tính theo giao dịch thanh toán thành công (UTC)</p>
            </div>
          </div>
          <TrendChart
            series={current.series}
            compare={false}
            currentLabel="Doanh thu"
            currentColor="#2563eb"
            valueFormatter={money}
          />
        </section>

        <section className="analytics-section-card">
          <div className="analytics-card-header">
            <div>
              <h3 className="analytics-card-title">
                <ReceiptLongOutlined fontSize="small" /> Cơ cấu trạng thái đơn hàng
              </h3>
              <p className="analytics-card-subtitle">Phân bổ toàn bộ giao dịch đã khởi tạo</p>
            </div>
          </div>
          <BreakdownDonut
            items={statusBreakdown}
            centerLabel="TỔNG ĐƠN"
            centerValue={number(denominator)}
            emptyMessage="Chưa có giao dịch phát sinh."
          />
          <div className="analytics-inline-kpis">
            <div>
              <CheckCircle sx={{ fontSize: 16, color: '#16a34a' }} />
              <span>Thành công: <b>{number(current.successfulOrders)}</b></span>
            </div>
            <div>
              <HourglassEmpty sx={{ fontSize: 16, color: '#ca8a04' }} />
              <span>Chờ xử lý: <b>{number(current.pendingOrders)}</b></span>
            </div>
            <div>
              <ErrorOutlined sx={{ fontSize: 16, color: '#dc2626' }} />
              <span>Thất bại / Hủy: <b>{number(current.failedOrders)}</b></span>
            </div>
          </div>
        </section>
      </div>

      <section className="analytics-section-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">
              <ReceiptLongOutlined fontSize="small" /> Bảng kê giao dịch
            </h3>
            <p className="analytics-card-subtitle">
              {mode === 'server'
                ? 'Đang xem toàn bộ lịch sử đơn hàng với phân trang máy chủ'
                : '10 giao dịch gần nhất · Dùng chung bộ phân trang quản trị'}
            </p>
          </div>
          <div className="analytics-mode-switch" role="group" aria-label="Chế độ xem giao dịch">
            <Button
              size="small"
              variant={mode === 'recent' ? 'contained' : 'outlined'}
              onClick={() => setMode('recent')}
            >
              Gần nhất
            </Button>
            <Button
              size="small"
              variant={mode === 'server' ? 'contained' : 'outlined'}
              onClick={() => setMode('server')}
            >
              Tất cả lịch sử
            </Button>
            <Button size="small" variant="outlined" startIcon={<Refresh />} onClick={mode === 'server' ? serverResource.reload : reload}>
              Làm mới
            </Button>
          </div>
        </div>

        <form
          className="analytics-table-toolbar"
          onSubmit={event => {
            event.preventDefault();
            setKeyword(keywordInput);
            recentPagination.onChange(0);
            serverPagination.onChange(0);
          }}
        >
          <TextField
            size="small"
            label="Tìm mã đơn, khóa học hoặc ID học viên"
            value={keywordInput}
            onChange={event => setKeywordInput(event.target.value)}
          />
          <TextField
            select
            size="small"
            label="Trạng thái"
            value={statusFilter}
            onChange={event => {
              setStatusFilter(event.target.value);
              recentPagination.onChange(0);
              serverPagination.onChange(0);
            }}
          >
            {statusOptions.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant="outlined">
            Lọc
          </Button>
          {(keyword || statusFilter !== 'ALL') && (
            <Button
              type="button"
              onClick={() => {
                setKeywordInput('');
                setKeyword('');
                setStatusFilter('ALL');
                recentPagination.onChange(0);
                serverPagination.onChange(0);
              }}
            >
              Xóa lọc
            </Button>
          )}
        </form>

        {mode === 'server' ? (
          <>
            <LoadState
              loading={serverResource.loading}
              error={serverResource.error}
              retry={serverResource.reload}
            />
            {!serverResource.loading && !serverResource.error && (
              <>
                <CommerceTable
                  embedded
                  rowKey="code"
                  rows={activeRows}
                  columns={transactionColumns}
                  emptyMessage="Chưa có giao dịch phù hợp."
                  ariaLabel="Bảng kê tất cả giao dịch"
                />
                <CommercePager
                  data={serverResource.data}
                  page={serverPagination.page}
                  size={serverPagination.size}
                  onChange={serverPagination.onChange}
                  onSizeChange={serverPagination.onSizeChange}
                />
              </>
            )}
          </>
        ) : (
          <CommerceTable
            embedded
            paginate
            pagination={recentPagination}
            rowKey="id"
            rows={activeRows}
            columns={transactionColumns}
            emptyMessage="Chưa có giao dịch."
            ariaLabel="Bảng kê giao dịch gần đây"
          />
        )}
      </section>
    </div>
  );
}
