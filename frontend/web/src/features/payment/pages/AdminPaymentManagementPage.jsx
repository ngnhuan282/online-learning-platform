import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, IconButton, MenuItem, Pagination, TextField, Tooltip } from '@mui/material';
import {
  AccountBalanceWalletOutlined,
  CancelOutlined,
  HourglassTopOutlined,
  Refresh,
  RestartAlt,
  Search,
  TaskAlt,
  VisibilityOutlined,
} from '@mui/icons-material';
import { PageHeading, StatCard, LoadState } from '../../admin/components/AdminUi';
import { date, money, number } from '../../admin/utils/adminUtils';
import { paymentApi } from '../api/paymentApi';

const statuses = {
  PENDING: 'Đang chờ',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Hoàn tiền',
};

function statusTone(status) {
  if (status === 'SUCCESS') return 'green';
  if (status === 'FAILED' || status === 'CANCELLED') return 'red';
  if (status === 'REFUNDED') return 'purple';
  return 'amber';
}

function currency(amount, code) {
  return code === 'VND' || !code ? money(amount) : `${number(amount)} ${code}`;
}

export default function AdminPaymentManagementPage() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') || '';
  const status = params.get('status') || '';
  const page = Math.max(0, Number(params.get('page')) || 0);
  const size = [10, 20, 50].includes(Number(params.get('size'))) ? Number(params.get('size')) : 10;
  const [searchDraft, setSearchDraft] = useState({ source: keyword, value: keyword });
  const query = searchDraft.source === keyword ? searchDraft.value : keyword;
  const [state, setState] = useState({ loading: true, data: null, stats: null, error: null });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      paymentApi.getAdminOrders({ page, size, keyword, status }),
      paymentApi.getAdminAnalytics(),
    ]).then(([ordersResult, statsResult]) => {
      if (!active) return;
      setState({
        loading: false,
        data: ordersResult.status === 'fulfilled' ? ordersResult.value.data : null,
        stats: statsResult.status === 'fulfilled' ? statsResult.value.data : null,
        error: ordersResult.status === 'rejected' ? ordersResult.reason : null,
      });
    });
    return () => {
      active = false;
    };
  }, [page, size, keyword, status, retry]);

  function filter(values) {
    const next = new URLSearchParams(params);
    Object.entries({ page: '', ...values }).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    setState(current => ({ ...current, loading: true }));
    setParams(next);
    setRetry(value => value + 1);
  }

  const rows = state.data?.content || [];
  const stats = state.stats;
  const failedCount = Number(stats?.failedPayments ?? 0);

  return (
    <>
      <PageHeading
        title="Quản lý giao dịch thanh toán"
        description="Theo dõi, tra cứu và xử lý trạng thái các giao dịch thanh toán của học viên."
      >
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          disabled={state.loading}
          onClick={() => {
            setState(current => ({ ...current, loading: true }));
            setRetry(value => value + 1);
          }}
        >
          Làm mới
        </Button>
      </PageHeading>

      <div className="admin-stats">
        <StatCard
          title="TỔNG GIAO DỊCH"
          value={number(stats?.totalOrders)}
          detail="Tất cả giao dịch đã được tạo"
          icon={<AccountBalanceWalletOutlined />}
        />
        <StatCard
          title="ĐANG CHỜ"
          value={number(stats?.pendingPayments)}
          detail={`${money(stats?.pendingAmount)} chưa hoàn tất`}
          icon={<HourglassTopOutlined />}
          tone="amber"
        />
        <StatCard
          title="THÀNH CÔNG"
          value={money(stats?.grossRevenue)}
          detail={`${number(stats?.successfulPayments)} giao dịch đã thanh toán`}
          icon={<TaskAlt />}
          tone="green"
        />
        <StatCard
          title="CẦN THEO DÕI"
          value={number(failedCount)}
          detail="Giao dịch thất bại hoặc đã hủy"
          icon={<CancelOutlined />}
          tone="red"
        />
      </div>

      <section className="admin-card admin-filters">
        <form
          className="admin-filter-row"
          onSubmit={event => {
            event.preventDefault();
            filter({ q: query.trim() });
          }}
        >
          <TextField
            size="small"
            placeholder="Tìm theo mã giao dịch hoặc khóa học..."
            aria-label="Tìm giao dịch thanh toán"
            value={query}
            onChange={event => setSearchDraft({ source: keyword, value: event.target.value })}
          />
          <Button type="submit" variant="outlined" startIcon={<Search />}>
            Tìm
          </Button>
          <TextField
            select
            size="small"
            label="Trạng thái"
            value={status}
            onChange={event => filter({ status: event.target.value })}
          >
            <MenuItem value="">Tất cả trạng thái</MenuItem>
            {Object.entries(statuses).map(([code, label]) => (
              <MenuItem key={code} value={code}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            startIcon={<RestartAlt />}
            onClick={() => {
              setSearchDraft({ source: '', value: '' });
              filter({ q: '', status: '' });
            }}
          >
            Đặt lại bộ lọc
          </Button>
        </form>
        <div className="admin-filter-summary">
          <span>
            Đang lọc: <b>{keyword || 'Tất cả giao dịch'}</b>
            {status && <span className={`admin-pill ${statusTone(status)}`}>{statuses[status]}</span>}
          </span>
          <span>
            Tìm thấy <b>{number(state.data?.totalElements)}</b> giao dịch phù hợp
          </span>
        </div>
      </section>

      <LoadState loading={state.loading} error={state.error} retry={() => setRetry(value => value + 1)} />
      {!state.loading && !state.error && (
        <section className="admin-card admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table admin-payments-table">
              <thead>
                <tr>
                  <th>MÃ GIAO DỊCH</th>
                  <th>HỌC VIÊN</th>
                  <th>KHÓA HỌC</th>
                  <th>SỐ TIỀN</th>
                  <th>TRẠNG THÁI</th>
                  <th>THỜI GIAN</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.orderCode}>
                    <td>
                      <Link className="admin-link-strong" to={`/admin/payments/${row.orderCode}`}>
                        {row.orderCode}
                      </Link>
                      <small>{row.provider || 'MOCK'}</small>
                    </td>
                    <td>#{row.userId}</td>
                    <td>{row.courseTitle || '—'}</td>
                    <td className="admin-nowrap">{currency(row.amount, row.currency)}</td>
                    <td>
                      <span className={`admin-pill ${statusTone(row.paymentStatus)}`}>
                        {statuses[row.paymentStatus] || row.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <span>{date(row.createdAt)}</span>
                      <small>Cập nhật: {date(row.updatedAt)}</small>
                    </td>
                    <td>
                      <Tooltip title="Xem chi tiết giao dịch">
                        <IconButton
                          component={Link}
                          to={`/admin/payments/${row.orderCode}`}
                          aria-label={`Xem giao dịch ${row.orderCode}`}
                        >
                          <VisibilityOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="admin-empty">
                Không có giao dịch phù hợp. Hãy thử thay đổi từ khóa hoặc bộ lọc trạng thái.
              </div>
            )}
          </div>
          <div className="admin-pagination">
            <span>
              Hiển thị {rows.length ? page * size + 1 : 0}–{page * size + rows.length} /{' '}
              {number(state.data?.totalElements)} giao dịch
            </span>
            <TextField
              select
              size="small"
              label="Số dòng"
              value={size}
              onChange={event => filter({ size: event.target.value })}
            >
              {[10, 20, 50].map(value => (
                <MenuItem key={value} value={value}>
                  {value} dòng / trang
                </MenuItem>
              ))}
            </TextField>
            <Pagination
              page={page + 1}
              count={Math.max(1, state.data?.totalPages || 1)}
              onChange={(_, value) => filter({ page: value - 1 })}
              color="primary"
              shape="rounded"
            />
          </div>
        </section>
      )}
    </>
  );
}
