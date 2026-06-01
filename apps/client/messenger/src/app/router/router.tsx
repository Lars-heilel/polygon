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

      // Guest routes (login, register, etc.)
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

      // Authenticated routes (chats, chat page)
      { element: <AppGuard />, children: appRoutes },

      // Dev-only design system page
      ...(import.meta.env.DEV
        ? [
            {
              path: '/ds',
              lazy: async () => {
                const [{ DesignSystemPage }, { ThemeToggle }] = await Promise.all([
                  import('@org/pages-design-system'),
                  import('@org/features-theme'),
                ]);
                return { element: <DesignSystemPage headerSlot={<ThemeToggle />} /> };
              },
            },
          ]
        : []),

      // 404 catch-all
      {
        path: '*',
        lazy: () => import('@org/pages-not-found').then((m) => ({ Component: m.NotFoundPage })),
      },
    ],
  },
]);
