import { Outlet, useLocation } from 'react-router-dom';
import SiteHeader from '../shared/components/SiteHeader';
import SiteFooter from '../shared/components/SiteFooter';
import ScrollToSection from '../shared/components/ScrollToSection';

function MainLayout() {
  const location = useLocation();
  const authPage = ['/login', '/register'].includes(location.pathname);
  return (
    <div className={authPage ? 'auth-shell' : undefined}>
      <ScrollToSection />
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <SiteHeader key={location.pathname + location.hash} />

      <main id="main-content">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}

export default MainLayout;
