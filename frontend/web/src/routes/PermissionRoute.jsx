import { Outlet } from 'react-router-dom';
import useAuth from '../features/auth/hooks/useAuth';
import ProtectedRoute from './ProtectedRoute';
import { can } from '../features/admin/utils/adminUtils';
import ForbiddenPage from '../pages/ForbiddenPage';

export default function PermissionRoute({ permission, children }) {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      {can(user, permission) ? (
        (children ?? <Outlet />)
      ) : (
        <ForbiddenPage />
      )}
    </ProtectedRoute>
  );
}
