import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, IconButton, MenuItem, Pagination, TextField, Tooltip, Skeleton } from '@mui/material';
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
import { getPaymentDisplayStatus } from '../utils/paymentFlow';
import '../styles/payment-admin.css';

const statuses = {
  PENDING: 'Đang chờ',
  EXPIRED: 'Hết hạn thanh toán',
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
  useLocale();
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') || '';
  const status = params.get('status') || '';
  const page = Math.max(0, Number(params.get('page')) || 0);
  const size = [10, 20, 50].includes(Number(params.get('size'))) ? Number(params.get('size')) : 10;
  const [searchDraft, setSearchDraft] = useState({ source: keyword, value: keyword });
  const query = searchDraft.source === keyword ? searchDraft.value : keyword;
  const [state, setState] = useState({
    loading: true,
    data: null,
    stats: null,
    error: null,
    statsError: null,
  });
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
        statsError: statsResult.status === 'rejected' ? statsResult.reason : null,
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
  const failedCount = stats?.failedPayments;

  return (
    <div className="workspace-scope admin-payment-workspace">
      <span className="workspace-kicker">{t('Quản trị thanh toán')}</span>
      <PageHeading
        title={t('Quản lý giao dịch thanh toán')}
        description={t('Theo dõi, tra cứu và xử lý trạng thái các giao dịch thanh toán của học viên.')}
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
          {t('Làm mới')}
        </Button>
      </PageHeading>

      {state.statsError && !state.loading && (
        <Alert severity="warning">
          {t(
            'Chưa tải được số liệu tổng quan. Danh sách giao dịch vẫn có thể tra cứu. Chọn Làm mới để thử lại.',
          )}
        </Alert>
      )}
      <div className="admin-stats" aria-busy={state.loading}>
        <StatCard
          title={t('TỔNG GIAO DỊCH')}
          value={state.loading ? <Skeleton width="65%" /> : number(stats?.totalOrders)}
          detail="Tất cả giao dịch đã được tạo"
          icon={<AccountBalanceWalletOutlined />}
        />
        <StatCard
          title={t('ĐANG CHỜ')}
          value={state.loading ? <Skeleton width="50%" /> : number(stats?.pendingPayments)}
          detail={`${money(stats?.pendingAmount)} chưa hoàn tất`}
          icon={<HourglassTopOutlined />}
          tone="amber"
        />
        <StatCard
          title={t('THÀNH CÔNG')}
          value={state.loading ? <Skeleton width="85%" /> : money(stats?.grossRevenue)}
          detail={`${number(stats?.successfulPayments)} giao dịch đã thanh toán`}
          icon={<TaskAlt />}
          tone="green"
        />
        <StatCard
          title={t('CẦN THEO DÕI')}
          value={state.loading ? <Skeleton width="50%" /> : number(failedCount)}
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
            placeholder={t('Tìm theo mã giao dịch hoặc khóa học...')}
            aria-label={t('Tìm giao dịch thanh toán')}
            value={query}
            onChange={event => setSearchDraft({ source: keyword, value: event.target.value })}
          />
          <Button type="submit" variant="outlined" startIcon={<Search />}>
            {t('Tìm')}
          </Button>
          <TextField
            select
            size="small"
            label={t('Trạng thái')}
            value={status}
            onChange={event => filter({ status: event.target.value })}
          >
            <MenuItem value="">{t('Tất cả trạng thái')}</MenuItem>
            {Object.entries(statuses).map(([code, label]) => (
              <MenuItem key={code} value={code}>
                {t(label)}
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
            {t('Đặt lại bộ lọc')}
          </Button>
        </form>
        <div className="admin-filter-summary">
          <span>
            {t('Đang lọc:')} <b>{keyword || t('Tất cả giao dịch')}</b>
            {status && <span className={`admin-pill ${statusTone(status)}`}>{statuses[status]}</span>}
          </span>
          <span>
            {t('Tìm thấy')} <b>{number(state.data?.totalElements)}</b> {t('giao dịch phù hợp')}
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
                  <th>{t('MÃ GIAO DỊCH')}</th>
                  <th>{t('HỌC VIÊN')}</th>
                  <th>{t('KHÓA HỌC')}</th>
                  <th>{t('SỐ TIỀN')}</th>
                  <th>{t('TRẠNG THÁI')}</th>
                  <th>{t('THỜI GIAN')}</th>
                  <th>{t('THAO TÁC')}</th>
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
                      <span className={`admin-pill ${statusTone(getPaymentDisplayStatus(row))}`}>
                        {statuses[getPaymentDisplayStatus(row)] || row.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <span>{date(row.createdAt)}</span>
                      <small>
                        {t('Cập nhật:')} {date(row.updatedAt)}
                      </small>
                    </td>
                    <td>
                      <Tooltip title={t('Xem chi tiết giao dịch')}>
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
                {t('Không có giao dịch phù hợp. Hãy thử thay đổi từ khóa hoặc bộ lọc trạng thái.')}
              </div>
            )}
          </div>
          <div className="admin-pagination">
            <span>
              {t('Hiển thị')} {rows.length ? page * size + 1 : 0}–{page * size + rows.length} /{' '}
              {number(state.data?.totalElements)} {t('giao dịch')}
            </span>
            <TextField
              select
              size="small"
              label={t('Số dòng')}
              value={size}
              onChange={event => filter({ size: event.target.value })}
            >
              {[10, 20, 50].map(value => (
                <MenuItem key={value} value={value}>
                  {value} {t('dòng / trang')}
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
    </div>
  );
}
