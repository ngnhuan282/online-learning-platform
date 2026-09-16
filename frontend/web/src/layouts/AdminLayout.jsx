import MainLayout from './MainLayout';
import RoleRoute from '../routes/RoleRoute';
import { ROLES } from '../shared/constants/roles';
export default function AdminLayout() {
  return (
    <RoleRoute roles={[ROLES.ADMIN]}>
      <MainLayout />
    </RoleRoute>
  );
}
