import { createBrowserRouter, Navigate } from 'react-router';
import { NotFoundPage } from '@org/pages';
import { ProtectedRoute, GuestRoute } from './protected-route';
import { ChatsLayout } from '../layouts/chats-layout';
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  ChatsPage,
  ChatPage,
  SettingsPage,
} from '../../pages';
import { ChatsTestPage } from '../../pages/chats-test/chats-test';
import { DesignSystemPage } from '@org/shared';
import { ThemeToggle } from '@org/features';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/chats" replace />,
  },

  {
    element: <GuestRoute />,
    children: [
      {
        path: '/auth',
        children: [
          { index: true, element: <Navigate to="/auth/login" replace /> },
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
        ],
      },
    ],
  },

  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/chats',
        element: <ChatsLayout />,
        children: [
          { index: true, element: <ChatsPage /> },
          { path: ':chatId', element: <ChatPage /> },
        ],
      },
      {
        path: '/settings',
        element: <SettingsPage />,
      },
    ],
  },

  ...(import.meta.env.DEV
    ? [
        {
          path: '/ds',
          element: <DesignSystemPage headerSlot={<ThemeToggle />} />,
        },
        {
          path: '/chats-test',
          element: <ChatsTestPage />,
        },
      ]
    : []),

  { path: '*', element: <NotFoundPage /> },
]);
