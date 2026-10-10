import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Brand from './Brand';
import Icon from './Icon';
import useAuth from '../../features/auth/hooks/useAuth';
import AccountMenu from './AccountMenu';
import NotificationBell from '../../features/learning/components/NotificationBell';

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pathname, hash } = useLocation();
  function submitSearch(event) {
    event.preventDefault();
    navigate(`/?q=${encodeURIComponent(search.trim())}#courses`);
    document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' });
  }
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} id="main-nav" aria-label="Điều hướng chính">
          <Link className={pathname === '/' && !hash ? 'active' : ''} to="/">
            Trang chủ
          </Link>
          <Link className={hash === '#courses' ? 'active' : ''} to="/#courses">
            Khóa học
          </Link>
          <Link className={hash === '#categories' ? 'active' : ''} to="/#categories">
            Danh mục
          </Link>
          <Link className={hash === '#benefits' ? 'active' : ''} to="/#benefits">
            Lợi ích
          </Link>
          {user && (
            <>
              <Link className={pathname === '/my-courses' ? 'active' : ''} to="/my-courses">
                Khóa của tôi
              </Link>
              <Link className={pathname === '/payment/history' ? 'active' : ''} to="/payment/history">
                Thanh toán
              </Link>
            </>
          )}
        </nav>
        <form className="header-search" onSubmit={submitSearch} role="search">
          <Icon name="search" size={17} />
          <input
            aria-label="Tìm kiếm khóa học tiếng Anh"
            placeholder="Tìm khóa học IELTS, TOEIC..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </form>
        <div className="header-actions">
          {user && <NotificationBell />}
          <span className="header-divider" />
          {user ? (
            <AccountMenu />
          ) : (
            <>
              <Link
                className="button button-outline login-link"
                to="/login"
                aria-current={pathname === '/login' ? 'page' : undefined}
              >
                Đăng nhập
              </Link>
              <Link
                className="button button-primary signup-link"
                to="/register"
                aria-current={pathname === '/register' ? 'page' : undefined}
              >
                Bắt đầu miễn phí <Icon name="arrow" size={16} />
              </Link>
            </>
          )}
          <button
            className="icon-button mobile-menu"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
    </header>
  );
}
