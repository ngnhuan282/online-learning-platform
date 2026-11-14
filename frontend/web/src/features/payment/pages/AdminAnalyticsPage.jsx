import { useCallback, useEffect, useMemo, useState } from 'react';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import { Link } from 'react-router-dom';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import { paymentApi } from '../api/paymentApi';
import { formatDemoPrice } from '../data/paymentDemo';
import { getPaymentDisplayStatus } from '../utils/paymentFlow';
import PaymentRevenueChart from '../components/PaymentRevenueChart';
import '../styles/payment.css';
import '../styles/payment-admin.css';

const EMPTY_LIST = [];

const statusLabel = {
  SUCCESS: 'Thành công',
  PENDING: 'Đang chờ',
  EXPIRED: 'Hết hạn thanh toán',
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

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatAmount(amount, currency = 'VND') {
  if (currency === 'VND') return formatDemoPrice(toNumber(amount));
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(toNumber(amount));
}

function formatDate(value) {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function buildCards(analytics) {
  if (!analytics) return EMPTY_LIST;
  return [
    {
      label: 'Doanh thu thành công',
      value: formatAmount(analytics.grossRevenue),
      helper: 'Chỉ tính các giao dịch đã thanh toán thành công',
      tone: 'blue',
      icon: 'chart',
    },
    {
      label: 'Tổng giao dịch',
      value: analytics.totalOrders,
      helper: 'Tổng lượt thanh toán đã được tạo',
      tone: 'green',
      icon: 'assignment',
    },
    {
      label: 'Đang chờ thanh toán',
      value: analytics.pendingPayments,
      helper: `${formatAmount(analytics.pendingAmount)} chưa hoàn tất`,
      tone: 'amber',
      icon: 'clock',
    },
    {
      label: 'Sẵn sàng ghi danh',
      value: analytics.crossService?.enrollmentReady ?? 0,
      helper: 'Giao dịch thành công có thể kích hoạt khóa học',
      tone: 'purple',
      icon: 'check',
    },
  ];
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAnalytics = useCallback(() => {
    setLoading(true);
    setError(null);
    paymentApi
      .getAdminAnalytics()
      .then(response => setAnalytics(response.data))
      .catch(fetchError => setError(fetchError))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    paymentApi
      .getAdminAnalytics()
      .then(response => {
        if (active) setAnalytics(response.data);
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
  }, []);

  const cards = useMemo(() => buildCards(analytics), [analytics]);
  const revenueSeries = analytics?.revenueSeries || EMPTY_LIST;
  const recentTransactions = analytics?.recentTransactions || EMPTY_LIST;

  return (
    <section className="workspace-scope payment-page admin-analytics-page">
      <div className="container">
        <div className="payment-page-heading admin-heading">
          <div className="admin-heading-main">
            <Link className="button button-outline admin-back-button" to="/admin">
              <ArrowBackRounded className="icon" style={{ fontSize: 17 }} aria-hidden="true" />
              Về trang admin
            </Link>
            <div>
              <span className="eyebrow">THỐNG KÊ THANH TOÁN</span>
              <h1>Tổng quan thanh toán</h1>
              <p>Theo dõi doanh thu, giao dịch và trạng thái ghi danh của các khóa học.</p>
            </div>
          </div>
          <div className="admin-heading-actions">
            <button
              className="button button-outline"
              type="button"
              onClick={loadAnalytics}
              disabled={loading}
            >
              Làm mới <RefreshRounded className="icon" style={{ fontSize: 17 }} aria-hidden="true" />
            </button>
          </div>
        </div>

        {loading ? (
          <article className="payment-panel">
            <AppLoading label="Đang tải thống kê thanh toán..." />
          </article>
        ) : error ? (
          <ErrorState error={error} title="Không thể tải thống kê thanh toán" onRetry={loadAnalytics} />
        ) : (
          <>
            <div className="analytics-card-grid">
              {cards.map(card => (
                <article className="analytics-card" key={card.label}>
                  <span className={`feature-icon ${card.tone}`}>
                    <Icon name={card.icon} size={20} />
                  </span>
                  <p>{card.label}</p>
                  <strong>{card.value}</strong>
                  <small>{card.helper}</small>
                </article>
              ))}
            </div>

            <div className="admin-analytics-grid">
              <article className="payment-panel revenue-panel">
                <div className="payment-panel-title">
                  <span className="feature-icon blue">
                    <Icon name="chart" size={20} />
                  </span>
                  <div>
                    <h2>Doanh thu 6 ngày gần nhất</h2>
                    <p>Chỉ tính thanh toán thành công theo ngày thanh toán, múi giờ UTC.</p>
                  </div>
                </div>
                <PaymentRevenueChart data={revenueSeries} />
                <p className="analytics-generated-at">Cập nhật: {formatDate(analytics?.generatedAt)}</p>
              </article>

              <article className="payment-panel admin-contract-panel">
                <div className="payment-panel-title">
                  <span className="feature-icon green">
                    <Icon name="check" size={20} />
                  </span>
                  <div>
                    <h2>Học viên & khóa học</h2>
                    <p>Tóm tắt số học viên, khóa học và giao dịch có thể kích hoạt học sau thanh toán.</p>
                  </div>
                </div>
                <ul className="payment-check-list">
                  <li>
                    <Icon name="check" size={18} />
                    {analytics?.crossService?.activeLearners ?? 0} học viên đã tạo giao dịch thanh toán.
                  </li>
                  <li>
                    <Icon name="check" size={18} />
                    {analytics?.crossService?.paidCourses ?? 0} khóa học đã có giao dịch phát sinh.
                  </li>
                  <li>
                    <Icon name="check" size={18} />
                    {analytics?.failedPayments ?? 0} giao dịch thất bại/đã hủy,{' '}
                    {formatAmount(analytics?.refundedAmount)} hoàn tiền.
                  </li>
                </ul>
              </article>
            </div>

            <article className="payment-panel transaction-panel">
              <div className="payment-panel-title">
                <span className="feature-icon purple">
                  <Icon name="assignment" size={20} />
                </span>
                <div>
                  <h2>Giao dịch gần đây</h2>
                  <p>10 giao dịch thanh toán mới nhất.</p>
                </div>
              </div>
              <div className="transaction-table-wrap">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Học viên</th>
                      <th>Khóa học</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.length === 0 ? (
                      <tr>
                        <td className="transaction-empty-cell" colSpan={6}>
                          Chưa có giao dịch thanh toán nào.
                        </td>
                      </tr>
                    ) : (
                      recentTransactions.map(transaction => (
                        <tr key={transaction.orderCode}>
                          <td>{transaction.orderCode}</td>
                          <td>User #{transaction.userId}</td>
                          <td>{transaction.courseTitle}</td>
                          <td>{formatAmount(transaction.amount, transaction.currency)}</td>
                          <td>
                            <span
                              className={`payment-status ${statusTone(getPaymentDisplayStatus(transaction))}`}
                            >
                              {statusLabel[getPaymentDisplayStatus(transaction)] || transaction.status}
                            </span>
                          </td>
                          <td>{formatDate(transaction.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        )}
      </div>
    </section>
  );
}
