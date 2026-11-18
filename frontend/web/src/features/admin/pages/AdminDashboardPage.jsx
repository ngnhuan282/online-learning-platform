import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import {
  Refresh,
  PeopleOutlined,
  AccountBalanceWalletOutlined,
  MenuBookOutlined,
  TaskAlt,
  ArrowForward,
  WorkspacePremiumOutlined,
} from '@mui/icons-material';
import useAuth from '../../auth/hooks/useAuth';
import { adminApi } from '../api/adminApi';
import { can, number, money, date } from '../utils/adminUtils';
import { PageHeading, StatCard, LoadState } from '../components/AdminUi';
import { getPaymentDisplayStatus } from '../../payment/utils/paymentFlow';
import PaymentRevenueChart from '../../payment/components/PaymentRevenueChart';
import TrendChart from '../components/analytics/TrendChart';
import '../../payment/styles/payment-admin.css';
import '../analytics/analytics.css';

const sources = [
  ['overview', 'DASHBOARD_VIEW', 'Tài khoản'],
  ['courses', 'COURSE_VIEW', 'Khóa học'],
  ['learning', 'LEARNING_REPORT_VIEW', 'Học tập'],
  ['payments', 'PAYMENT_REPORT_VIEW', 'Thanh toán'],
];
const colors = ['#2563eb', '#38bdf8', '#1646b5', '#a8b8d5', '#86a9f9'];

// --- Mock trend / KPI data (replace with API when available) ---
const dashboardTrend = {
  revenueSeries: [
    { label: 'T2', current: 12500000, previous: 9800000 },
    { label: 'T3', current: 15200000, previous: 11000000 },
    { label: 'T4', current: 13800000, previous: 10500000 },
    { label: 'T5', current: 18900000, previous: 14200000 },
    { label: 'T6', current: 21500000, previous: 16000000 },
    { label: 'T7', current: 17300000, previous: 13500000 },
    { label: 'CN', current: 9800000, previous: 8200000 },
  ],
  learnerSeries: [
    { label: 'T2', current: 42, previous: 35 },
    { label: 'T3', current: 58, previous: 44 },
    { label: 'T4', current: 51, previous: 40 },
    { label: 'T5', current: 73, previous: 55 },
    { label: 'T6', current: 68, previous: 52 },
    { label: 'T7', current: 45, previous: 38 },
    { label: 'CN', current: 29, previous: 24 },
  ],
};
const dashboardKPIs = {
  proMembers: { current: 142, previous: 118 },
  lessonsCompleted: { current: 1847, previous: 1523 },
};

const PERIOD_PRESETS = [
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: 'thisMonth', label: 'Tháng này' },
  { key: 'lastMonth', label: 'Tháng trước' },
];

// Helper: compute % change badge
function growthBadge(current, previous) {
  if (previous == null || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        fontSize: 12,
        fontWeight: 600,
        color: up ? '#16a34a' : '#dc2626',
        marginTop: 2,
      }}
    >
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% so với kỳ trước
    </span>
  );
}

const paymentLabels = {
  PENDING: 'Đang chờ',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn thanh toán',
  REFUNDED: 'Hoàn tiền',
};

function paymentTone(status) {
  if (status === 'SUCCESS') return 'green';
  if (status === 'FAILED' || status === 'CANCELLED') return 'red';
  return status === 'REFUNDED' ? 'purple' : 'amber';
}

export default function AdminDashboardPage() {
  useLocale();
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, data: {}, errors: [] });
  const [retry, setRetry] = useState(0);
  const [activePeriod, setActivePeriod] = useState('7d');
  useEffect(() => {
    let active = true;
    const allowed = sources.filter(([, permission]) => can(user, permission));
    Promise.allSettled(allowed.map(([key]) => adminApi[key]())).then(results => {
      if (!active) return;
      const data = {},
        errors = [];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') data[allowed[i][0]] = result.value.data;
        else errors.push(allowed[i][2]);
      });
      setState({ loading: false, data, errors });
    });
    return () => {
      active = false;
    };
  }, [user, retry]);
  const { overview, courses, learning, payments } = state.data;
  const months = overview?.monthly ?? [];
  const revenueSeries = payments?.revenueSeries ?? [];
  const recentTransactions = payments?.recentTransactions ?? [];
  const maxUsers = Math.max(1, ...months.map(m => m.count ?? 0));
  const periodRevenue = payments
    ? revenueSeries.reduce((sum, point) => sum + Number(point.amount ?? 0), 0)
    : undefined;
  const categories = courses?.categories ?? [];
  const total = categories.reduce((sum, c) => sum + c.count, 0);
  let cursor = 0;
  const gradient = categories
    .map((c, i) => {
      const start = cursor;
      cursor += total ? (c.count / total) * 100 : 0;
      return `${colors[i % colors.length]} ${start}% ${cursor}%`;
    })
    .join(',');
  return (
    <div className="workspace-scope admin-dashboard-workspace">
      <span className="workspace-kicker">{t('Không gian quản trị')}</span>
      <section className="admin-welcome">
        <PageHeading
          title={`Chào mừng trở lại, ${user?.fullName || t('Quản trị viên')}!`}
          description={t('Theo dõi tài khoản, khóa học và hoạt động học tập của hệ thống.')}
        >
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            disabled={state.loading}
            onClick={() => {
              setState(s => ({ ...s, loading: true }));
              setRetry(r => r + 1);
            }}
          >
            {t('Làm mới dữ liệu')}
          </Button>
          {can(user, 'USER_CREATE') && (
            <Button component={Link} to="/admin/users?create=1" variant="contained">
              {t('+ Thêm tài khoản')}
            </Button>
          )}
        </PageHeading>
      </section>
      {/* Period filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {PERIOD_PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => setActivePeriod(p.key)}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              border: activePeriod === p.key ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
              background: activePeriod === p.key ? '#2563eb' : '#fff',
              color: activePeriod === p.key ? '#fff' : '#374151',
              fontWeight: activePeriod === p.key ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <LoadState loading={state.loading} />
      {state.errors.length > 0 && (
        <Alert severity="warning">
          {t('Chưa tải được:')} {state.errors.join(', ')}
          {t('. Kiểm tra service và chọn Làm mới dữ liệu.')}
        </Alert>
      )}
      <div className="admin-stats">
        {can(user, 'PAYMENT_REPORT_VIEW') && (
          <StatCard
            title={t('TỔNG DOANH THU')}
            value={money(payments?.grossRevenue)}
            detail={
              <>
                Tổng giá trị đơn đã thanh toán (VND)
                <br />
                {growthBadge(
                  dashboardTrend.revenueSeries.reduce((s, r) => s + r.current, 0),
                  dashboardTrend.revenueSeries.reduce((s, r) => s + r.previous, 0),
                )}
              </>
            }
            icon={<AccountBalanceWalletOutlined />}
          />
        )}
        {can(user, 'DASHBOARD_VIEW') && (
          <StatCard
            title={t('TÀI KHOẢN HỆ THỐNG')}
            value={number(overview?.total)}
            detail={
              <>
                {`${number(overview?.newThisWeek)} tài khoản mới trong 7 ngày`}
                <br />
                {growthBadge(
                  dashboardTrend.learnerSeries.reduce((s, r) => s + r.current, 0),
                  dashboardTrend.learnerSeries.reduce((s, r) => s + r.previous, 0),
                )}
              </>
            }
            icon={<PeopleOutlined />}
            tone="cyan"
          />
        )}
        {can(user, 'COURSE_VIEW') && (
          <StatCard
            title={t('KHÓA HỌC ĐANG MỞ')}
            value={number(courses?.published)}
            detail={`Trong tổng số ${number(courses?.total)} khóa học`}
            icon={<MenuBookOutlined />}
          />
        )}
        {can(user, 'LEARNING_REPORT_VIEW') && (
          <StatCard
            title={t('BÀI HỌC HOÀN THÀNH')}
            value={number(dashboardKPIs.lessonsCompleted.current)}
            detail={
              <>
                {`${number(learning?.completed)} / ${number(learning?.enrollments)} lượt ghi danh hợp lệ`}
                <br />
                {growthBadge(dashboardKPIs.lessonsCompleted.current, dashboardKPIs.lessonsCompleted.previous)}
              </>
            }
            icon={<TaskAlt />}
            tone="green"
          />
        )}
        <StatCard
          title={t('THÀNH VIÊN PRO')}
          value={number(dashboardKPIs.proMembers.current)}
          detail={
            <>
              Thành viên đang hoạt động Pro
              <br />
              {growthBadge(dashboardKPIs.proMembers.current, dashboardKPIs.proMembers.previous)}
            </>
          }
          icon={<WorkspacePremiumOutlined />}
          tone="amber"
        />
      </div>
      <div className="admin-dashboard-charts">
        {/* --- Trend charts row --- */}
        <section className="admin-card">
          <div className="admin-card-heading">
            <div>
              <h2>{t('Xu hướng doanh thu')}</h2>
              <p>{t('7 ngày · So sánh kỳ trước')}</p>
            </div>
          </div>
          <TrendChart
            series={dashboardTrend.revenueSeries}
            compare
            currentLabel="Kỳ này"
            previousLabel="Kỳ trước"
            currentColor="#2563eb"
            previousColor="#94a3b8"
            valueFormatter={money}
          />
        </section>
        <section className="admin-card">
          <div className="admin-card-heading">
            <div>
              <h2>{t('Xu hướng học viên mới')}</h2>
              <p>{t('7 ngày · So sánh kỳ trước')}</p>
            </div>
          </div>
          <TrendChart
            series={dashboardTrend.learnerSeries}
            compare
            currentLabel="Kỳ này"
            previousLabel="Kỳ trước"
            currentColor="#0ea5e9"
            previousColor="#94a3b8"
            valueFormatter={number}
          />
        </section>
        {can(user, 'PAYMENT_REPORT_VIEW') && (
          <section className="admin-card payment-dashboard-revenue">
            <div className="admin-card-heading">
              <div>
                <h2>{t('Doanh thu thanh toán')}</h2>
                <p>{t('6 ngày gần nhất · Theo ngày thanh toán (UTC)')}</p>
              </div>
              <span className="admin-pill green">{t('Giao dịch thành công')}</span>
            </div>
            <strong className="payment-period-revenue">
              {state.loading ? t('Đang tải…') : money(periodRevenue)}
            </strong>
            <PaymentRevenueChart data={revenueSeries} loading={state.loading} unavailable={!payments} />
          </section>
        )}
        {can(user, 'DASHBOARD_VIEW') && (
          <section className="admin-card">
            <div className="admin-card-heading">
              <div>
                <h2>{t('Tăng trưởng tài khoản')}</h2>
                <p>{t('Tài khoản mới trong 6 tháng gần nhất')}</p>
              </div>
            </div>
            {months.length ? (
              <div className="admin-bar-chart" role="img" aria-label={t('Số tài khoản mới theo tháng')}>
                {months.map((m, i) => (
                  <div className="admin-bar-column" key={m.month}>
                    <div className="admin-bars">
                      <div
                        className="admin-bar cyan"
                        style={{ height: `${((m.count ?? 0) / maxUsers) * 85}%` }}
                        title={`${number(m.count)} tài khoản`}
                      >
                        <span>{number(m.count)}</span>
                      </div>
                    </div>
                    <small className={i === months.length - 1 ? 'current' : ''}>
                      {m.month.slice(5)}/{m.month.slice(0, 4)}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-empty">{t('Chưa có dữ liệu tài khoản.')}</div>
            )}
            <p className="admin-card-note">{t('Tài khoản được nhóm theo tháng đăng ký (UTC).')}</p>
          </section>
        )}
        {can(user, 'COURSE_VIEW') && (
          <section className="admin-card">
            <h2>{t('Phân bố khóa học')}</h2>
            <p>{t('Số khóa học theo danh mục')}</p>
            <div
              className="admin-donut"
              style={{ background: total ? `conic-gradient(${gradient})` : '#e6ecf5' }}
            >
              <div>
                <strong>{number(courses?.total)}</strong>
                <small>{t('KHÓA HỌC')}</small>
              </div>
            </div>
            <div className="admin-category-legend">
              {categories.map((c, i) => (
                <div key={c.name}>
                  <i style={{ background: colors[i % colors.length] }} />
                  <span>{t(c.name)}</span>
                  <b>{number(c.count)}</b>
                </div>
              ))}
            </div>
            {!categories.length && <p>{t('Chưa có danh mục.')}</p>}
          </section>
        )}
      </div>
      {can(user, 'PAYMENT_REPORT_VIEW') && (
        <section className="admin-card admin-transactions">
          <div className="admin-card-heading">
            <div>
              <h2>
                {t('Đơn hàng gần nhất')} <span className="admin-pill green">{t('Dữ liệu hệ thống')}</span>
              </h2>
              <p>{t('5 đơn mới nhất, gồm cả đơn chưa thanh toán')}</p>
            </div>
            <Button component={Link} to="/admin/payments" endIcon={<ArrowForward />}>
              {t('Quản lý thanh toán')}
            </Button>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('MÃ ĐƠN')}</th>
                  <th>{t('HỌC VIÊN')}</th>
                  <th>{t('KHÓA HỌC')}</th>
                  <th>{t('SỐ TIỀN')}</th>
                  <th>{t('TRẠNG THÁI')}</th>
                  <th>{t('THỜI GIAN')}</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.slice(0, 5).map(order => (
                  <tr key={order.orderCode}>
                    <td>
                      <Link className="admin-link-strong" to={`/admin/payments/${order.orderCode}`}>
                        {order.orderCode}
                      </Link>
                    </td>
                    <td>#{order.userId}</td>
                    <td>{order.courseTitle || '—'}</td>
                    <td className="admin-nowrap">
                      {order.currency === 'VND'
                        ? money(order.amount)
                        : `${number(order.amount)} ${order.currency}`}
                    </td>
                    <td>
                      <span className={`admin-pill ${paymentTone(getPaymentDisplayStatus(order))}`}>
                        {paymentLabels[getPaymentDisplayStatus(order)] || order.status}
                      </span>
                    </td>
                    <td>{date(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!recentTransactions.length && (
              <div className="admin-empty">
                {payments ? t('Chưa có đơn hàng.') : t('Chưa tải được dữ liệu thanh toán.')}
              </div>
            )}
          </div>
        </section>
      )}
      <div className="admin-bottom-grid">
        {courses && (
          <section className="admin-card">
            <h2>{t('Khóa học mới nhất')}</h2>
            <p>{t('Được sắp xếp theo ngày tạo')}</p>
            {courses.recent.map((course, i) => (
              <div className="admin-course-row" key={course.id}>
                <span className="admin-rank">0{i + 1}</span>
                <div>
                  <strong>{course.title}</strong>
                  <small>{course.status}</small>
                </div>
                <b>{money(course.price)}</b>
              </div>
            ))}
            <Button component={Link} to="/admin/courses" endIcon={<ArrowForward />}>
              {t('Quản lý khóa học')}
            </Button>
          </section>
        )}
        <section className="admin-card admin-security-card">
          <AdminPanel />
          <h2>{t('Quản trị & bảo mật')}</h2>
          <p>{t('Phân quyền theo chức năng và theo dõi thay đổi tài khoản trong nhật ký quản trị.')}</p>
          <div className="admin-actions">
            {can(user, 'ROLE_VIEW') && (
              <Button component={Link} to="/admin/roles" variant="outlined">
                {t('Quản lý phân quyền')}
              </Button>
            )}
            {can(user, 'AUDIT_VIEW') && (
              <Button component={Link} to="/admin/audit">
                {t('Xem nhật ký →')}
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminPanel() {
  useLocale();
  return <TaskAlt className="admin-security-large" />;
}
