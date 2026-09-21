import { createBrowserRouter } from 'react-router-dom';

import MainLayout from '../layouts/MainLayout';

import HomePage from '../pages/HomePage';
import UserLayout from '../layouts/UserLayout';
import AdminLayout from '../layouts/AdminLayout';
import AccountPage from '../features/auth/pages/AccountPage';
import PaymentCheckoutPage from '../features/payment/pages/PaymentCheckoutPage';
import PaymentResultPage from '../features/payment/pages/PaymentResultPage';
import AdminAnalyticsPage from '../features/payment/pages/AdminAnalyticsPage';

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
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AccountPage admin /> },
      { path: 'analytics', element: <AdminAnalyticsPage /> },
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
    ],
  },
]);

export default router;
