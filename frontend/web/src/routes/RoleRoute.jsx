import { Outlet } from 'react-router-dom';
import useAuth from '../features/auth/hooks/useAuth';
import ProtectedRoute from './ProtectedRoute';
import ErrorState from '../shared/components/ErrorState';
export default function RoleRoute({ roles = [], children }) {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      {roles.some(role => user?.roles?.includes(role)) ? (
        (children ?? <Outlet />)
      ) : (
        <ErrorState
          title="Không có quyền truy cập"
          error={{ message: 'Tài khoản của bạn không có quyền truy cập nội dung này.' }}
        />
      )}
    </ProtectedRoute>
  );
}
