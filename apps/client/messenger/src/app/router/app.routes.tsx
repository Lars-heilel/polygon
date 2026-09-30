import { CLIENT_ROUTES } from '@org/common';
import { Navigate, RouteObject } from 'react-router';

export const appRoutes: RouteObject[] = [
  {
    path: CLIENT_ROUTES.root,
    lazy: () => import('@org/pages-chats-layout').then((m) => ({ Component: m.ChatsLayout })),
    children: [
      {
        path: CLIENT_ROUTES.chats.root,
        children: [
          {
            index: true,
            lazy: () =>
              import('@org/pages-messenger-main').then((m) => ({ Component: m.MessengerMainPage })),
          },
          {
            // Absolute child path keeps ChatsLayout mounted while the URL
            // can never collide with static top-level routes (/profile, /settings).
            path: CLIENT_ROUTES.chats.byId(':chatId'),
            lazy: () => import('@org/pages-chat-page').then((m) => ({ Component: m.ChatPage })),
          },
        ],
      },
      {
        path: CLIENT_ROUTES.profile.root,
        lazy: () => import('@org/pages-profile').then((m) => ({ Component: m.ProfilePage })),
      },
      {
        path: CLIENT_ROUTES.profile.edit,
        lazy: () =>
          import('@org/pages-profile-edit').then((m) => ({ Component: m.EditProfilePage })),
      },
      {
        path: CLIENT_ROUTES.settings.root,
        lazy: () => import('@org/pages-settings').then((m) => ({ Component: m.SettingsPage })),
      },
      // Backward-compat redirects for the old nested urls.
      {
        path: '/chats/profile',
        element: (
          <Navigate
            to={CLIENT_ROUTES.profile.root}
            replace
          />
        ),
      },
      {
        path: '/chats/profile/edit',
        element: (
          <Navigate
            to={CLIENT_ROUTES.profile.edit}
            replace
          />
        ),
      },
      {
        path: '/chats/settings',
        element: (
          <Navigate
            to={CLIENT_ROUTES.settings.root}
            replace
          />
        ),
      },
    ],
  },
];
