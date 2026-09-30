import { CLIENT_ROUTES } from '@org/common';
import { Navigate, createBrowserRouter } from 'react-router';

import { appRoutes } from './app.routes';
import { authRoutes } from './auth.routes';
import { AppGuard, GuestGuard } from './guards';
import { RouteError } from './route-error';

export const router = createBrowserRouter([
  {
    path: CLIENT_ROUTES.root,
    errorElement: <RouteError />,
    children: [
      // Guest routes (landing, login, register, etc.)
      {
        element: <GuestGuard />,
        children: [
          {
            index: true,
            lazy: () => import('@org/pages-landing').then((m) => ({ Component: m.LandingPage })),
          },
          {
            path: CLIENT_ROUTES.auth.root,
            children: [
              {
                index: true,
                element: (
                  <Navigate
                    to={CLIENT_ROUTES.auth.login}
                    replace
                  />
                ),
              },
              ...authRoutes,
            ],
          },
        ],
      },

      // Legacy share-by-link path, canonical is `/` (see GuestGuard index).
      {
        path: CLIENT_ROUTES.landing,
        element: (
          <Navigate
            to={CLIENT_ROUTES.root}
            replace
          />
        ),
      },

      // Authenticated routes (chats, profile, settings)
      { element: <AppGuard />, children: appRoutes },

      // Dev-only pages
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
