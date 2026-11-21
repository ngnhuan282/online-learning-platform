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
import ProUpgradeButton from './ProUpgradeButton';
import HeaderUtilities from './HeaderUtilities';

export default function SiteHeader() {
  useLocale();

  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pathname, search: locationSearch, hash } = useLocation();

  function submitSearch(event) {
    event.preventDefault();
    navigate(`/?q=${encodeURIComponent(search.trim())}#courses`);
    document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <header className={`site-header ${user ? 'is-authenticated' : ''}`}>
      <div className="container header-inner">
        <Brand />

        <nav className="main-nav" id="main-nav" aria-label={t('Điều hướng chính')}>
          <Link
            className={pathname === ROUTES.HOME && !hash ? 'active' : ''}
            aria-current={pathname === ROUTES.HOME && !hash ? 'page' : undefined}
            to={ROUTES.HOME}
          >
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

          <HeaderUtilities />
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
          {user && <ProUpgradeButton />}
          <LanguageSwitcher />
          {user && <HeaderProgress />}
          {user && <NotificationBell />}
          <span className="header-divider" />

          {user ? (
            <AccountMenu />
          ) : (
            <Link
              className="button button-outline login-link"
              to="/login"
              state={pathname !== '/login' ? { from: `${pathname}${locationSearch}${hash}` } : undefined}
              aria-current={pathname === '/login' ? 'page' : undefined}
            >
              {t('Đăng nhập')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
