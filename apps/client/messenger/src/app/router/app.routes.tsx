import { RouteObject } from 'react-router';

export const appRoutes: RouteObject[] = [
  {
    path: '/chats',
    lazy: () => import('@org/pages').then((m) => ({ Component: m.ChatsLayout })),
    children: [
      {
        index: true,
        lazy: () => import('@org/pages').then((m) => ({ Component: m.MessengerMainPage })),
      },
      {
        path: ':chatId',
        lazy: () => import('@org/pages').then((m) => ({ Component: m.ChatPage })),
      },
    ],
  },
];
