import { createBrowserRouter, Navigate } from 'react-router';
import { NotFoundPage } from '@org/pages';
import { ProtectedRoute, GuestRoute } from './protected-route';
import { ChatsLayout } from '../layouts/chats-layout';
import { LoginPage } from '../../pages/login';
import { RegisterPage } from '../../pages/register';
import { ForgotPasswordPage } from '../../pages/forgot-password';
import { ResetPasswordPage } from '../../pages/reset-password';
import { ChatsPage } from '../../pages/chats';
import { ChatPage } from '../../pages/chat';
import { SettingsPage } from '../../pages/settings';
import { DesignSystemPage } from '../../pages/design-system';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/chats" replace />,
  },

  // Guest only — redirect to /chats if already logged in
  {
    element: <GuestRoute />,
    children: [
      {
        path: '/auth',
        children: [
          { index: true, element: <Navigate to="/auth/login" replace /> },
          { path: 'login',           element: <LoginPage /> },
          { path: 'register',        element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password',  element: <ResetPasswordPage /> },
        ],
      },
    ],
  },

  // Protected — redirect to /auth/login if not logged in
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/chats',
        element: <ChatsLayout />,
        children: [
          { index: true,     element: <ChatsPage /> },
          { path: ':chatId', element: <ChatPage /> },
        ],
      },
      {
        path: '/settings',
        element: <SettingsPage />,
      },
    ],
  },

  // Dev only
  ...(import.meta.env.DEV
    ? [{ path: '/ds', element: <DesignSystemPage /> }]
    : []),

  // 404
  { path: '*', element: <NotFoundPage /> },
]);
