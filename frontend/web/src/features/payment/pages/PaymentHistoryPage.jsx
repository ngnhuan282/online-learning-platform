import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MenuItem, Pagination, TextField } from '@mui/material';
import AppLoading from '../../../shared/components/AppLoading';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { paymentApi } from '../api/paymentApi';
import { formatDemoPrice } from '../data/paymentDemo';
import { getPaymentDisplayStatus } from '../utils/paymentFlow';
import '../styles/payment.css';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const statusLabel = {
  PENDING: 'Đang chờ',
  EXPIRED: 'Hết hạn thanh toán',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Hoàn tiền',
};

function statusTone(status) {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED' || status === 'CANCELLED') return 'failed';
  if (status === 'REFUNDED') return 'refunded';
  return 'pending';
}

function formatDate(value) {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function PaymentHistoryPage() {
  const [history, setHistory] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [keyword, setKeyword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    paymentApi
      .getHistory({ page, size: pageSize, keyword: searchQuery, status: statusFilter })
      .then(response => {
        if (active) {
          setHistory(response.data);
          setError(null);
        }
      })
      .catch(fetchError => {
        if (active) setError(fetchError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, pageSize, searchQuery, statusFilter, retryCount]);

  function refreshHistory() {
    setLoading(true);
    setRetryCount(value => value + 1);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setPage(0);
    setSearchQuery(keyword);
    setRetryCount(value => value + 1);
  }

  function handleStatusChange(event) {
    setLoading(true);
    setPage(0);
    setStatusFilter(event.target.value);
  }

  function handleResetFilters() {
    setLoading(true);
    setKeyword('');
    setSearchQuery('');
    setStatusFilter('');
    setPage(0);
    setRetryCount(value => value + 1);
  }

  function handlePageSizeChange(event) {
    setLoading(true);
    setPage(0);
    setPageSize(Number(event.target.value));
  }

  const items = history?.content || [];
  const totalPages = history?.totalPages || 1;
  const totalElements = history?.totalElements || 0;
  const hasFilters = Boolean(searchQuery || statusFilter);

  return (
    <section className="workspace-scope payment-page payment-history-page">
      <div className="container">
        <div className="payment-page-heading admin-heading">
          <div>
            <span className="workspace-kicker">Giao dịch của bạn</span>
            <h1>Lịch sử thanh toán</h1>
            <p>Theo dõi các giao dịch thanh toán khóa học của bạn.</p>
          </div>
          <Link className="button button-outline" to={ROUTES.COURSES}>
            Chọn khóa học <Icon name="arrow" size={16} />
          </Link>
        </div>

        <div className="payment-filter-panel">
          <form className="payment-filter-search" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              placeholder="Tìm theo mã đơn hoặc khóa học..."
              aria-label="Tìm theo mã đơn hoặc khóa học"
            />
            <button className="button button-primary" type="submit">
              <Icon name="search" size={15} /> Tìm kiếm
            </button>
          </form>

          <div className="payment-filter-actions">
            <select aria-label="Lọc trạng thái thanh toán" value={statusFilter} onChange={handleStatusChange}>
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Đang chờ</option>
              <option value="EXPIRED">Hết hạn thanh toán</option>
              <option value="SUCCESS">Thành công</option>
              <option value="FAILED">Thất bại</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="REFUNDED">Hoàn tiền</option>
            </select>
            {hasFilters && (
              <button className="button button-soft" type="button" onClick={handleResetFilters}>
                Đặt lại
              </button>
            )}
            <button className="button button-outline" type="button" onClick={refreshHistory}>
              Tải lại
            </button>
          </div>
        </div>

        <article className="payment-panel transaction-panel">
          <div className="payment-table-heading">
            <div>
              <h2>Tất cả giao dịch</h2>
              <p>{hasFilters ? 'Kết quả theo bộ lọc hiện tại' : 'Lịch sử mua khóa học của bạn'}</p>
            </div>
            {!loading && !error && <span className="payment-count-badge">{totalElements} giao dịch</span>}
          </div>
          {loading ? (
            <AppLoading label="Đang tải lịch sử thanh toán..." />
          ) : error ? (
            <ErrorState error={error} title="Không thể tải lịch sử thanh toán" onRetry={refreshHistory} />
          ) : items.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'Không tìm thấy giao dịch' : 'Chưa có giao dịch'}
              description={
                hasFilters
                  ? 'Hãy thử đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái.'
                  : 'Khi bạn thanh toán khóa học, giao dịch sẽ xuất hiện ở đây.'
              }
              action={
                hasFilters ? (
                  <button className="button button-primary" type="button" onClick={handleResetFilters}>
                    Xóa bộ lọc
                  </button>
                ) : (
                  <Link className="button button-primary" to={ROUTES.COURSES}>
                    Chọn khóa học <Icon name="arrow" size={17} />
                  </Link>
                )
              }
            />
          ) : (
            <>
              <div className="transaction-table-wrap">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Khóa học</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                      <th>Hoàn tất</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.orderCode}>
                        <td>{item.orderCode}</td>
                        <td>{item.courseTitle}</td>
                        <td>{formatDemoPrice(Number(item.amount))}</td>
                        <td>
                          <span className={`payment-status ${statusTone(getPaymentDisplayStatus(item))}`}>
                            {statusLabel[getPaymentDisplayStatus(item)] || item.paymentStatus}
                          </span>
                        </td>
                        <td>{formatDate(item.createdAt)}</td>
                        <td>{formatDate(item.paidAt)}</td>
                        <td>
                          <Link
                            to={`${ROUTES.PAYMENT_RESULT}?orderCode=${encodeURIComponent(item.orderCode)}`}
                          >
                            Chi tiết
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="payment-pagination">
                <span>
                  Hiển thị {items.length ? page * pageSize + 1 : 0}–{page * pageSize + items.length} /{' '}
                  {totalElements} giao dịch
                </span>
                <TextField
                  select
                  size="small"
                  label="Số dòng"
                  value={pageSize}
                  onChange={handlePageSizeChange}
                >
                  {PAGE_SIZE_OPTIONS.map(value => (
                    <MenuItem key={value} value={value}>
                      {value} dòng / trang
                    </MenuItem>
                  ))}
                </TextField>
                <Pagination
                  page={page + 1}
                  count={Math.max(1, totalPages)}
                  onChange={(_, value) => {
                    setLoading(true);
                    setPage(value - 1);
                  }}
                  color="primary"
                  shape="rounded"
                />
              </div>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
