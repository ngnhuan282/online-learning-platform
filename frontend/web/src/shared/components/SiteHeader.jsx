import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Brand from './Brand';
import Icon from './Icon';
import useAuth from '../../features/auth/hooks/useAuth';
import AccountMenu from './AccountMenu';
import NotificationBell from '../../features/learning/components/NotificationBell';
import { ROUTES } from '../constants/routes';
import LanguageSwitcher from './LanguageSwitcher';
import HeaderProgress from './HeaderProgress';

export default function SiteHeader() {
  useLocale();
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
    <header className={`site-header ${user ? 'is-authenticated' : ''}`}>
      <div className="container header-inner">
        <Brand />
        <nav
          className={`main-nav ${menuOpen ? 'is-open' : ''}`}
          id="main-nav"
          aria-label={t('Điều hướng chính')}
          onClick={() => setMenuOpen(false)}
        >
          <Link className={pathname === '/' && !hash ? 'active' : ''} to="/">
            {t('Trang chủ')}
          </Link>
          <Link className={hash === '#courses' ? 'active' : ''} to="/#courses">
            {t('Khóa học')}
          </Link>
          <Link className={pathname.startsWith(ROUTES.TOEIC) ? 'active' : ''} to={ROUTES.TOEIC}>
            {t('Luyện thi TOEIC')}
          </Link>
          <Link
            className={`header-secondary-link ${hash === '#categories' ? 'active' : ''}`}
            to="/#categories"
          >
            {t('Danh mục')}
          </Link>
          <Link className={`header-secondary-link ${hash === '#benefits' ? 'active' : ''}`} to="/#benefits">
            {t('Lợi ích')}
          </Link>
          {user && (
            <>
              <Link className={pathname === '/my-courses' ? 'active' : ''} to="/my-courses">
                {t('Khóa của tôi')}
              </Link>
              <Link className={pathname.startsWith('/community') ? 'active' : ''} to={ROUTES.COMMUNITY}>
                {t('Diễn đàn')}
              </Link>
              <Link className={pathname === ROUTES.LEADERBOARD ? 'active' : ''} to={ROUTES.LEADERBOARD}>
                {t('Bảng xếp hạng')}
              </Link>
              <Link className={pathname === ROUTES.SHOP ? 'active' : ''} to={ROUTES.SHOP}>
                {t('Cửa hàng')}
              </Link>
              <Link className={pathname === '/payment/history' ? 'active' : ''} to="/payment/history">
                {t('Thanh toán')}
              </Link>
              <Link
                className={pathname === ROUTES.AI_ASSISTANT ? 'active' : ''}
                aria-current={pathname === ROUTES.AI_ASSISTANT ? 'page' : undefined}
                to={ROUTES.AI_ASSISTANT}
                onClick={() => setMenuOpen(false)}
              >
                {t('Trợ lý AI')}
              </Link>
            </>
          )}
        </nav>
        <form className="header-search" onSubmit={submitSearch} role="search">
          <Icon name="search" size={17} />
          <input
            aria-label={t('Tìm kiếm khóa học tiếng Anh')}
            placeholder={t('Tìm khóa học IELTS, TOEIC...')}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </form>
        <div className="header-actions">
          <LanguageSwitcher />
          {user && <HeaderProgress />}
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
                {t('Đăng nhập')}
              </Link>
              <Link
                className="button button-primary signup-link"
                to="/register"
                aria-current={pathname === '/register' ? 'page' : undefined}
              >
                {t('Bắt đầu miễn phí')} <Icon name="arrow" size={16} />
              </Link>
            </>
          )}
          <button
            className="icon-button mobile-menu"
            aria-label={menuOpen ? t('Đóng menu') : t('Mở menu')}
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
