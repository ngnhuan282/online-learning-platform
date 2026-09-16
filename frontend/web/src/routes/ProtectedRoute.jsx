import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../features/auth/hooks/useAuth';
import AppLoading from '../shared/components/AppLoading';
import { ROUTES } from '../shared/constants/routes';
import ErrorState from '../shared/components/ErrorState';
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, sessionError, retrySession } = useAuth();
  const location = useLocation();
  if (isLoading) return <AppLoading />;
  if (sessionError) return <ErrorState error={sessionError} onRetry={retrySession} />;
  return isAuthenticated ? (
    (children ?? <Outlet />)
  ) : (
    <Navigate
      to={ROUTES.LOGIN}
      replace
      state={{ from: location.pathname + location.search + location.hash }}
    />
  );
}
