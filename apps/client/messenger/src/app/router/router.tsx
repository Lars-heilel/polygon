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
      // Guest routes (landing, login, register, etc.)
      {
        element: <GuestGuard />,
        children: [
          {
            index: true,
            lazy: () =>
              import('@org/pages-landing').then((m) => ({ Component: m.LandingPage })),
          },
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

      // Public landing (share-by-link only, noindex)
      {
        path: '/landing',
        lazy: () => import('@org/pages-landing').then((m) => ({ Component: m.LandingPage })),
      },

      // Authenticated routes (chats, chat page)
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
            {
              path: '/media-test',
              lazy: () => import('@org/pages-media-test').then((m) => ({ Component: m.MediaTestPage })),
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
