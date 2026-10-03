import { createBrowserRouter, Navigate } from 'react-router-dom';

import MainLayout from '../layouts/MainLayout';
import AdminLayout from '../layouts/AdminLayout';
import UserLayout from '../layouts/UserLayout';
import ProtectedRoute from '../routes/ProtectedRoute';

import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';
import AccountPage from '../features/auth/pages/AccountPage';
import PaymentCheckoutPage from '../features/payment/pages/PaymentCheckoutPage';
import AdminPaymentDetailPage from '../features/payment/pages/AdminPaymentDetailPage';
import AdminPaymentManagementPage from '../features/payment/pages/AdminPaymentManagementPage';
import PaymentHistoryPage from '../features/payment/pages/PaymentHistoryPage';
import MockPaymentPage from '../features/payment/pages/MockPaymentPage';
import PaymentResultPage from '../features/payment/pages/PaymentResultPage';
import PermissionRoute from '../routes/PermissionRoute';
import RoleRoute from '../routes/RoleRoute';
import AdminDashboardPage from '../features/admin/pages/AdminDashboardPage';
import AdminAccountsPage from '../features/admin/pages/AdminAccountsPage';
import AdminRolesPage from '../features/admin/pages/AdminRolesPage';
import AdminAuditPage from '../features/admin/pages/AdminAuditPage';

const router = createBrowserRouter([
  {
    path: '/account',
    element: <UserLayout />,
    children: [{ index: true, element: <AccountPage /> }],
  },
  {
    path: '/checkout',
    element: <UserLayout />,
    children: [{ index: true, element: <PaymentCheckoutPage /> }],
  },
  {
    path: '/payment/result',
    element: <UserLayout />,
    children: [{ index: true, element: <PaymentResultPage /> }],
  },
  {
    path: '/payment/mock',
    element: <UserLayout />,
    children: [{ index: true, element: <MockPaymentPage /> }],
  },
  {
    path: '/payment/history',
    element: <UserLayout />,
    children: [{ index: true, element: <PaymentHistoryPage /> }],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'profile', element: <AccountPage /> },
      { path: 'analytics', element: <Navigate to="/admin" replace /> },
      {
        path: 'payments',
        element: <PermissionRoute permission="PAYMENT_REPORT_VIEW" />,
        children: [
          { index: true, element: <AdminPaymentManagementPage /> },
          { path: ':orderCode', element: <AdminPaymentDetailPage /> },
        ],
      },
      {
        path: 'roles',
        element: (
          <PermissionRoute permission="ROLE_VIEW">
            <AdminRolesPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'audit',
        element: (
          <PermissionRoute permission="AUDIT_VIEW">
            <AdminAuditPage />
          </PermissionRoute>
        ),
      },
      { path: 'course', element: <Navigate to="/admin/courses" replace /> },
      {
        path: 'quizzes',
        element: <RoleRoute roles={['ADMIN']} />,
        children: [{
          index: true,
          lazy: async () => ({
            Component: (await import('../features/learning/pages/AdminQuizPage')).default,
          }),
        }],
      },
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
          {
            path: ':courseId/curriculum',
            lazy: async () => ({
              Component: (await import('../features/courses/pages/CurriculumBuilderPage')).default,
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
        element: <PermissionRoute permission="COURSE_VIEW" />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('../features/courses/pages/AdminCategoryPage')).default,
            }),
          },
        ],
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
        lazy: async () => ({
          Component: (await import('../features/courses/pages/CourseDetailPage')).default,
        }),
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
            path: 'quizzes/:quizId',
            lazy: async () => ({
              Component: (await import('../features/learning/pages/QuizPage')).default,
            }),
          },
          {
            path: 'quizzes/:quizId/result',
            lazy: async () => ({
              Component: (await import('../features/learning/pages/QuizResultPage')).default,
            }),
          },
          {
            path: 'quizzes/attempts/:attemptId/result',
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
