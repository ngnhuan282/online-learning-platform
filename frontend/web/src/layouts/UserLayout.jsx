import MainLayout from './MainLayout';
import ProtectedRoute from '../routes/ProtectedRoute';
export default function UserLayout() {
  return (
    <ProtectedRoute>
      <MainLayout />
    </ProtectedRoute>
  );
}
