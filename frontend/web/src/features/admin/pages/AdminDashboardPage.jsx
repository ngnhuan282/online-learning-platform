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
} from '@mui/icons-material';
import useAuth from '../../auth/hooks/useAuth';
import { adminApi } from '../api/adminApi';
import { can, number, money, date } from '../utils/adminUtils';
import { PageHeading, StatCard, LoadState } from '../components/AdminUi';

const sources = [
  ['overview', 'DASHBOARD_VIEW', 'Tài khoản'],
  ['courses', 'COURSE_VIEW', 'Khóa học'],
  ['learning', 'LEARNING_REPORT_VIEW', 'Học tập'],
  ['payments', 'PAYMENT_REPORT_VIEW', 'Thanh toán'],
];
const colors = ['#2563eb', '#38bdf8', '#1646b5', '#a8b8d5', '#86a9f9'];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, data: {}, errors: [] });
  const [retry, setRetry] = useState(0);
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
  const months = overview?.monthly ?? payments?.monthly ?? [];
  const maxUsers = Math.max(1, ...months.map(m => m.count ?? 0));
  const maxRevenue = Math.max(1, ...(payments?.monthly ?? []).map(m => m.revenue));
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
    <>
      <section className="admin-welcome">
        <PageHeading
          title={`Chào mừng trở lại, ${user?.fullName || 'Quản trị viên'}!`}
          description="Theo dõi tài khoản, khóa học và hoạt động học tập của hệ thống."
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
            Làm mới dữ liệu
          </Button>
          {can(user, 'USER_CREATE') && (
            <Button component={Link} to="/admin/users?create=1" variant="contained">
              + Thêm tài khoản
            </Button>
          )}
        </PageHeading>
      </section>
      <LoadState loading={state.loading} />
      {state.errors.length > 0 && (
        <Alert severity="warning">
          Chưa tải được: {state.errors.join(', ')}. Kiểm tra service và chọn Làm mới dữ liệu.
        </Alert>
      )}
      <div className="admin-stats">
        {can(user, 'PAYMENT_REPORT_VIEW') && (
          <StatCard
            title="TỔNG DOANH THU"
            value={money(payments?.grossRevenue)}
            detail="Tổng giá trị đơn đã thanh toán (VND)"
            icon={<AccountBalanceWalletOutlined />}
          />
        )}
        {can(user, 'DASHBOARD_VIEW') && (
          <StatCard
            title="TÀI KHOẢN HỆ THỐNG"
            value={number(overview?.total)}
            detail={`${number(overview?.newThisWeek)} tài khoản mới trong 7 ngày`}
            icon={<PeopleOutlined />}
            tone="cyan"
          />
        )}
        {can(user, 'COURSE_VIEW') && (
          <StatCard
            title="KHÓA HỌC ĐANG MỞ"
            value={number(courses?.published)}
            detail={`Trong tổng số ${number(courses?.total)} khóa học`}
            icon={<MenuBookOutlined />}
          />
        )}
        {can(user, 'LEARNING_REPORT_VIEW') && (
          <StatCard
            title="TỶ LỆ HOÀN THÀNH"
            value={learning ? `${learning.completionRate.toFixed(1)}%` : '—'}
            detail={`${number(learning?.completed)} / ${number(learning?.enrollments)} lượt ghi danh hợp lệ`}
            icon={<TaskAlt />}
            tone="green"
          />
        )}
      </div>
      <div className="admin-dashboard-charts">
        <section className="admin-card">
          <div className="admin-card-heading">
            <div>
              <h2>Doanh thu & tăng trưởng tài khoản</h2>
              <p>6 tháng gần nhất · mỗi chuỗi có thang đo riêng</p>
            </div>
          </div>
          <div className="admin-chart-legend">
            <span>
              <i />
              Doanh thu (triệu ₫)
            </span>
            <span>
              <i className="cyan" />
              Tài khoản mới
            </span>
          </div>
          {months.length ? (
            <div className="admin-bar-chart" role="img" aria-label="Doanh thu và số tài khoản mới theo tháng">
              {months.map((m, i) => {
                const revenue = payments?.monthly.find(p => p.month === m.month)?.revenue;
                return (
                  <div className="admin-bar-column" key={m.month}>
                    <div className="admin-bars">
                      <div
                        className="admin-bar"
                        style={{ height: `${((revenue ?? 0) / maxRevenue) * 85}%` }}
                        title={money(revenue)}
                      >
                        <span>{revenue == null ? '—' : number(Math.round(revenue / 100000) / 10)}</span>
                      </div>
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
                );
              })}
            </div>
          ) : (
            <div className="admin-empty">Chưa có dữ liệu biểu đồ.</div>
          )}
          <p className="admin-card-note">
            Doanh thu được nhóm theo tháng tạo đơn đã thanh toán. Tài khoản được nhóm theo ngày đăng ký (UTC).
          </p>
        </section>
        {can(user, 'COURSE_VIEW') && (
          <section className="admin-card">
            <h2>Phân bố khóa học</h2>
            <p>Số khóa học theo danh mục</p>
            <div
              className="admin-donut"
              style={{ background: total ? `conic-gradient(${gradient})` : '#e6ecf5' }}
            >
              <div>
                <strong>{number(courses?.total)}</strong>
                <small>KHÓA HỌC</small>
              </div>
            </div>
            <div className="admin-category-legend">
              {categories.map((c, i) => (
                <div key={c.name}>
                  <i style={{ background: colors[i % colors.length] }} />
                  <span>{c.name}</span>
                  <b>{number(c.count)}</b>
                </div>
              ))}
            </div>
            {!categories.length && <p>Chưa có danh mục.</p>}
          </section>
        )}
      </div>
      {can(user, 'PAYMENT_REPORT_VIEW') && (
        <section className="admin-card admin-transactions">
          <div className="admin-card-heading">
            <div>
              <h2>
                Đơn hàng gần nhất <span className="admin-pill green">Dữ liệu hệ thống</span>
              </h2>
              <p>5 đơn mới nhất, gồm cả đơn chưa thanh toán</p>
            </div>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>MÃ ĐƠN</th>
                  <th>HỌC VIÊN</th>
                  <th>KHÓA HỌC</th>
                  <th>SỐ TIỀN</th>
                  <th>TRẠNG THÁI</th>
                  <th>THỜI GIAN</th>
                </tr>
              </thead>
              <tbody>
                {payments?.recent?.map(order => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderCode}</strong>
                    </td>
                    <td>#{order.userId}</td>
                    <td>{order.courses.join(', ') || '—'}</td>
                    <td className="admin-nowrap">
                      {order.currency === 'VND'
                        ? money(order.amount)
                        : `${number(order.amount)} ${order.currency}`}
                    </td>
                    <td>
                      <span className={`admin-pill ${order.status === 'PAID' ? 'green' : 'amber'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{date(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!payments?.recent?.length && (
              <div className="admin-empty">
                {payments ? 'Chưa có đơn hàng.' : 'Chưa tải được dữ liệu thanh toán.'}
              </div>
            )}
          </div>
        </section>
      )}
      <div className="admin-bottom-grid">
        {courses && (
          <section className="admin-card">
            <h2>Khóa học mới nhất</h2>
            <p>Được sắp xếp theo ngày tạo</p>
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
              Quản lý khóa học
            </Button>
          </section>
        )}
        <section className="admin-card admin-security-card">
          <AdminPanel />
          <h2>Quản trị & bảo mật</h2>
          <p>Phân quyền theo chức năng và theo dõi thay đổi tài khoản trong nhật ký quản trị.</p>
          <div className="admin-actions">
            {can(user, 'ROLE_VIEW') && (
              <Button component={Link} to="/admin/roles" variant="outlined">
                Quản lý phân quyền
              </Button>
            )}
            {can(user, 'AUDIT_VIEW') && (
              <Button component={Link} to="/admin/audit">
                Xem nhật ký →
              </Button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function AdminPanel() {
  return <TaskAlt className="admin-security-large" />;
}
