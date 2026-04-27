import { Navigate, createBrowserRouter } from 'react-router';

import { appRoutes } from './app.routes';
import { authRoutes } from './auth.routes';
import { AppGuard, GuestGuard } from './guards';
import { RouteError } from './route-error';

export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: (
          <Navigate
            to="/chats"
            replace
          />
        ),
      },

      {
        element: <GuestGuard />,
        children: [
          {
            path: '/auth',
            children: [
              {
                index: true,
                element: (
                  <Navigate
                    to="/auth/login"
                    replace
                  />
                ),
              },
              ...authRoutes,
            ],
          },
        ],
      },

      {
        element: <AppGuard />,
        children: appRoutes,
      },

      ...(import.meta.env.DEV
        ? [
            {
              path: '/ds',
              lazy: async () => {
                const [{ DesignSystemPage }, { ThemeToggle }] = await Promise.all([
                  import('@org/pages'),
                  import('@org/features'),
                ]);
                return { element: <DesignSystemPage headerSlot={<ThemeToggle />} /> };
              },
            },
          ]
        : []),

      {
        path: '*',
        lazy: () => import('@org/pages').then((m) => ({ Component: m.NotFoundPage })),
      },
    ],
  },
]);
