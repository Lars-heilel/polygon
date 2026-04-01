import { OAuthButtons, ThemeToggle } from '@org/features';
import {
  ChatPage,
  ChatsLayout,
  CheckEmailPage,
  EmailVerifiedPage,
  ForgotPasswordPage,
  LoginPage,
  MessengerMainPage,
  NotFoundPage,
  RegisterPage,
  ResetPasswordPage,
  SettingsPage,
} from '@org/pages';
import { DesignSystemPage } from '@org/shared';
import { Navigate, createBrowserRouter } from 'react-router';

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
          { path: 'register', element: <RegisterPage oauthSlot={<OAuthButtons />} /> },
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
          { index: true, element: <MessengerMainPage /> },
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
      ]
    : []),

  { path: '*', element: <NotFoundPage /> },
]);
