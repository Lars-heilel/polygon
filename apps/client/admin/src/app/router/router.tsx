import { Navigate, createBrowserRouter } from 'react-router';

import { AdminNotFoundPage } from '@org/pages-admin-not-found';
import { AdminOverviewPage } from '@org/pages-admin-overview';
import { AdminUserDetailPage } from '@org/pages-admin-user-detail';
import { AdminUsersPage } from '@org/pages-admin-users';

import { AdminGuard } from './guards';

export const createAdminRouter = () =>
  createBrowserRouter(
    [
      {
        path: '/',
        element: <AdminGuard />,
        children: [
          {
            index: true,
            element: <AdminOverviewPage />,
          },
          {
            path: 'users',
            element: <AdminUsersPage />,
          },
          {
            path: 'users/:id',
            element: <AdminUserDetailPage />,
          },
        ],
      },
      {
        path: '/404',
        element: <AdminNotFoundPage />,
      },
      {
        path: '*',
        element: (
          <Navigate
            to="/404"
            replace
          />
        ),
      },
    ],
    {
      basename: '/admin',
    },
  );

export const router = createAdminRouter();
