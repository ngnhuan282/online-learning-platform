import { NavLink } from 'react-router-dom';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import '../styles/workspace.css';

const destinations = [
  { to: '/dashboard', label: 'Tổng quan', Icon: DashboardOutlined },
  { to: '/my-courses', label: 'Khóa học của tôi', Icon: AutoStoriesOutlined },
  { to: '/notifications', label: 'Thông báo', Icon: NotificationsNone },
];

export default function LearningHeader({ title, description, children, navigation = true }) {
  return (
    <>
      {navigation && (
        <nav className="learning-navigation" aria-label="Điều hướng học tập">
          {destinations.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
              <Icon fontSize="small" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
      <header className="learning-page-header">
        <div>
          <h1>{title}</h1>
          {description && <p className="learning-page-description">{description}</p>}
        </div>
        {children && <div className="learning-header-actions">{children}</div>}
      </header>
    </>
  );
}
