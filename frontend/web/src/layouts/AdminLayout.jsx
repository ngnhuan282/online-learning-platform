import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Avatar, Button, IconButton } from '@mui/material';
import { SchoolOutlined, DashboardOutlined, PeopleOutlined, AdminPanelSettingsOutlined, MenuBookOutlined, HistoryOutlined, Logout, Menu, Search, OpenInNew, Close } from '@mui/icons-material';
import PermissionRoute from '../routes/PermissionRoute';
import useAuth from '../features/auth/hooks/useAuth';
import { can, initials } from '../features/admin/utils/adminUtils';
import '../features/admin/admin.css';

const menu = [
  { to: '/admin', label: 'Tổng quan', icon: DashboardOutlined, permission: 'DASHBOARD_VIEW', end: true },
  { to: '/admin/users', label: 'Quản lý tài khoản', icon: PeopleOutlined, permission: 'USER_VIEW' },
  { to: '/admin/roles', label: 'Vai trò & Phân quyền', icon: AdminPanelSettingsOutlined, permission: 'ROLE_VIEW' },
  { to: '/admin/courses', label: 'Khóa học Tiếng Anh', icon: MenuBookOutlined, permission: 'COURSE_VIEW' },
  { to: '/admin/audit', label: 'Nhật ký quản trị', icon: HistoryOutlined, permission: 'AUDIT_VIEW' },
];

export default function AdminLayout() {
  const { user, logout, isLoggingOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  async function signOut() {
    const result = await logout();
    navigate('/login', { replace: true, state: result.error ? { message: 'Đã thoát phiên trên trình duyệt.' } : null });
  }
  return <PermissionRoute permission="ADMIN_ACCESS"><div className="admin-shell">
    {open && <button className="admin-backdrop" aria-label="Đóng điều hướng" onClick={() => setOpen(false)} />}
    <aside className={`admin-sidebar ${open ? 'is-open' : ''}`}>
      <Link className="admin-brand" to="/admin"><span className="admin-brand-icon"><SchoolOutlined /></span><span>LearnSphere<small>ENGLISH PLATFORM</small></span><b>Admin</b></Link>
      <div className="admin-menu-label">QUẢN TRỊ HỆ THỐNG</div>
      <nav aria-label="Quản trị">{menu.filter(item => can(user, item.permission)).map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}><Icon fontSize="small" />{label}</NavLink>)}</nav>
      <div className="admin-menu-label">KHÔNG GIAN HỌC TẬP</div>
      <nav><Link to="/"><OpenInNew fontSize="small" />Xem website</Link></nav>
      <div className="admin-sidebar-bottom"><div className="admin-security"><AdminPanelSettingsOutlined /><span>Không gian quản trị<small>Truy cập theo quyền được cấp</small></span></div><Button color="inherit" startIcon={<Logout />} onClick={signOut} disabled={isLoggingOut}>Đăng xuất</Button></div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar"><IconButton className="admin-menu-toggle" aria-label={open ? 'Đóng menu' : 'Mở menu'} onClick={() => setOpen(!open)}>{open ? <Close /> : <Menu />}</IconButton>
        {can(user, 'USER_VIEW') ? <form className="admin-global-search" onSubmit={event => { event.preventDefault(); navigate(`/admin/users?q=${encodeURIComponent(search)}`); }}><Search fontSize="small" /><input aria-label="Tìm tài khoản nhanh" placeholder="Tìm nhanh tài khoản theo tên, email..." value={search} onChange={event => setSearch(event.target.value)} /></form> : <span>LearnSphere Admin</span>}
        <div className="admin-profile"><Avatar>{initials(user?.fullName)}</Avatar><span><strong>{user?.fullName}</strong><small>{user?.roles?.join(' · ')}</small></span></div>
      </header>
      <main className="admin-main"><Outlet /></main>
      <footer className="admin-footer"><span><SchoolOutlined fontSize="small" /> LearnSphere</span><span>Không gian quản trị hệ thống học tập</span><Link to="/">Về trang học tập ↗</Link></footer>
    </div>
  </div></PermissionRoute>;
}
