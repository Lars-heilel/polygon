import { ThemeToggle } from '@org/features';
import { NotFoundPage } from '@org/pages';
import { DesignSystemPage } from '@org/shared';
import { Navigate, createBrowserRouter } from 'react-router';

import {
  ChatPage,
  ChatsPage,
  CheckEmailPage,
  EmailVerifiedPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  SettingsPage,
} from '../../pages';
import { ChatsTestPage } from '../../pages/chats-test/chats-test';
import { ChatsLayout } from '../layouts/chats-layout';
import { GuestRoute, ProtectedRoute } from './protected-route';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Navigate
        to="/chats"
        replace
      />
    ),
  },

  {
    element: <GuestRoute />,
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
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'check-email', element: <CheckEmailPage /> },
          { path: 'email-verified', element: <EmailVerifiedPage /> },
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
