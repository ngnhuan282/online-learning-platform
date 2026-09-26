import { createBrowserRouter, Navigate } from 'react-router-dom';

import MainLayout from '../layouts/MainLayout';
import AdminLayout from '../layouts/AdminLayout';
import UserLayout from '../layouts/UserLayout'; // Thêm import UserLayout

import HomePage from '../pages/HomePage';
import AccountPage from '../features/auth/pages/AccountPage';
import PaymentCheckoutPage from '../features/payment/pages/PaymentCheckoutPage';
import PaymentHistoryPage from '../features/payment/pages/PaymentHistoryPage';
import PaymentResultPage from '../features/payment/pages/PaymentResultPage';
import PermissionRoute from '../routes/PermissionRoute';
import AdminDashboardPage from '../features/admin/pages/AdminDashboardPage';
import AdminAccountsPage from '../features/admin/pages/AdminAccountsPage';
import AdminRolesPage from '../features/admin/pages/AdminRolesPage';
import AdminAuditPage from '../features/admin/pages/AdminAuditPage';

const router = createBrowserRouter([
  { 
    path: '/account', 
    element: <UserLayout />, 
    children: [{ index: true, element: <AccountPage /> }] 
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AccountPage admin /> },
      { path: 'course', element: <Navigate to="/admin/courses" replace /> },
      {
        path: 'courses',
        element: <PermissionRoute permission="COURSE_VIEW" />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('../features/courses/pages/AdminCoursePage')).default,
            }),
          },
        ],
      },
      {
        path: 'users',
        element: (
          <PermissionRoute permission="USER_VIEW">
            <AdminAccountsPage />
          </PermissionRoute>
        ),
      },
      { path: 'category', element: <Navigate to="/admin/categories" replace /> },
      {
        path: 'categories',
        lazy: async () => ({ Component: (await import('../features/courses/pages/AdminCategoryPage')).default }),
      },
    ],
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'login',
        lazy: async () => ({ Component: (await import('../features/auth/pages/LoginPage')).default }),
      },
      {
        path: 'register',
        lazy: async () => ({ Component: (await import('../features/auth/pages/RegisterPage')).default }),
      },
      {
        path: 'courses',
        lazy: async () => ({ Component: (await import('../features/courses/pages/CourseListPage')).default }),
      },
      {
        path: 'courses/:id',
        lazy: async () => ({ Component: (await import('../features/courses/pages/CourseDetailPage')).default }),
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: 'dashboard',
            lazy: async () => ({
              Component: (await import('../features/learning/pages/UserDashboardPage')).default,
            }),
          },
          {
            path: 'my-courses',
            lazy: async () => ({
              Component: (await import('../features/learning/pages/MyCoursesPage')).default,
            }),
          },
          {
            path: 'learning/:courseId',
            lazy: async () => ({
              Component: (await import('../features/learning/pages/LearningPage')).default,
            }),
          },
          {
            path: 'quizzes/:quizId/result',
            lazy: async () => ({
              Component: (await import('../features/learning/pages/QuizResultPage')).default,
            }),
          },
          {
            path: 'notifications',
            lazy: async () => ({
              Component: (await import('../features/learning/pages/NotificationsPage')).default,
            }),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default router;