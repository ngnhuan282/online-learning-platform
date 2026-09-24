import { Outlet } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import useAuth from '../features/auth/hooks/useAuth';
import ProtectedRoute from './ProtectedRoute';
import { can } from '../features/admin/utils/adminUtils';

export default function PermissionRoute({ permission, children }) {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      {can(user, permission) ? (
        (children ?? <Outlet />)
      ) : (
        <Alert severity="warning">Bạn không có quyền truy cập chức năng này.</Alert>
      )}
    </ProtectedRoute>
  );
}
