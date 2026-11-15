import { t } from '../shared/i18n/locale';
import useLocale from '../shared/i18n/useLocale';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { IconButton } from '@mui/material';
import {
  SchoolOutlined,
  DashboardOutlined,
  PeopleOutlined,
  AccountBalanceWalletOutlined,
  AdminPanelSettingsOutlined,
  MenuBookOutlined,
  RateReviewOutlined,
  QuizOutlined,
  NotificationsOutlined,
  HistoryOutlined,
  Menu,
  Search,
  OpenInNew,
  Close,
} from '@mui/icons-material';
import PermissionRoute from '../routes/PermissionRoute';
import useAuth from '../features/auth/hooks/useAuth';
import { can } from '../features/admin/utils/adminUtils';
import AccountMenu from '../shared/components/AccountMenu';
import LanguageSwitcher from '../shared/components/LanguageSwitcher';
import { ROUTES } from '../shared/constants/routes';
import '../features/admin/admin.css';

const menu = [
  { to: '/admin', label: 'Tổng quan', icon: DashboardOutlined, permission: 'DASHBOARD_VIEW', end: true },
  { to: '/admin/users', label: 'Quản lý tài khoản', icon: PeopleOutlined, permission: 'USER_VIEW' },
  {
    to: '/admin/payments',
    label: 'Thanh toán',
    icon: AccountBalanceWalletOutlined,
    permission: 'PAYMENT_REPORT_VIEW',
  },
  {
    to: '/admin/roles',
    label: 'Vai trò & Phân quyền',
    icon: AdminPanelSettingsOutlined,
    permission: 'ROLE_VIEW',
  },
  { to: '/admin/courses', label: 'Khóa học Tiếng Anh', icon: MenuBookOutlined, permission: 'COURSE_VIEW' },
  { to: '/admin/categories', label: 'Quản lý danh mục', icon: SchoolOutlined, permission: 'COURSE_VIEW' },
  { to: '/admin/reviews', label: 'Quản lý đánh giá', icon: RateReviewOutlined, permission: 'COURSE_VIEW' },
  {
    to: ROUTES.ADMIN_QUIZZES,
    label: 'Quản lý quiz',
    icon: QuizOutlined,
    permission: 'ADMIN_ACCESS',
    adminOnly: true,
  },
  {
    to: ROUTES.ADMIN_NOTIFICATIONS,
    label: 'Thông báo',
    icon: NotificationsOutlined,
    permission: 'ADMIN_ACCESS',
    adminOnly: true,
  },
  { to: '/admin/audit', label: 'Nhật ký quản trị', icon: HistoryOutlined, permission: 'AUDIT_VIEW' },
];

export default function AdminLayout() {
  useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  return (
    <PermissionRoute permission="ADMIN_ACCESS">
      <div className="admin-shell">
        {open && (
          <button
            className="admin-backdrop"
            aria-label={t('Đóng điều hướng')}
            onClick={() => setOpen(false)}
          />
        )}
        <aside className={`admin-sidebar ${open ? 'is-open' : ''}`}>
          <Link className="admin-brand" to="/admin">
            <span className="admin-brand-icon">
              <SchoolOutlined />
            </span>
            <span>
              ChitChatGo<small>ENGLISH PLATFORM</small>
            </span>
            <b>Admin</b>
          </Link>
          <div className="admin-menu-label">{t('QUẢN TRỊ HỆ THỐNG')}</div>
          <nav aria-label={t('Quản trị')}>
            {menu
              .filter(
                item => can(user, item.permission) && (!item.adminOnly || user?.roles?.includes('ADMIN')),
              )
              .map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}>
                  <Icon fontSize="small" />
                  {t(label)}
                </NavLink>
              ))}
          </nav>
          <div className="admin-menu-label">{t('KHÔNG GIAN HỌC TẬP')}</div>
          <nav>
            <Link to="/">
              <OpenInNew fontSize="small" />
              Xem website
            </Link>
          </nav>
          <div className="admin-sidebar-bottom">
            <div className="admin-security">
              <AdminPanelSettingsOutlined />
              <span>
                {t('Không gian quản trị')}
                <small>{t('Truy cập theo quyền được cấp')}</small>
              </span>
            </div>
          </div>
        </aside>
        <div className="admin-workspace">
          <header className="admin-topbar">
            <IconButton
              className="admin-menu-toggle"
              aria-label={open ? t('Đóng menu') : t('Mở menu')}
              onClick={() => setOpen(!open)}
            >
              {open ? <Close /> : <Menu />}
            </IconButton>
            {can(user, 'USER_VIEW') ? (
              <form
                className="admin-global-search"
                onSubmit={event => {
                  event.preventDefault();
                  navigate(`/admin/users?q=${encodeURIComponent(search)}`);
                }}
              >
                <Search fontSize="small" />
                <input
                  aria-label={t('Tìm tài khoản nhanh')}
                  placeholder={t('Tìm nhanh tài khoản theo tên, email...')}
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </form>
            ) : (
              <span>ChitChatGo Admin</span>
            )}
            <div className="admin-profile">
              <LanguageSwitcher />
              <AccountMenu profileTo={ROUTES.ADMIN_PROFILE} showDetails />
            </div>
          </header>
          <main className="admin-main">
            <Outlet />
          </main>
          <footer className="admin-footer">
            <span>
              <SchoolOutlined fontSize="small" /> ChitChatGo
            </span>
            <span>{t('Không gian quản trị hệ thống học tập')}</span>
            <Link to="/">{t('Về trang học tập ↗')}</Link>
          </footer>
        </div>
      </div>
    </PermissionRoute>
  );
}
