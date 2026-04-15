import { RouteObject } from 'react-router';

export const authRoutes: RouteObject[] = [
  {
    path: 'login',
    lazy: () => import('@org/pages').then((m) => ({ Component: m.LoginPage })),
  },
  {
    path: 'register',
    lazy: () => import('@org/pages').then((m) => ({ Component: m.RegisterPage })),
  },
  {
    path: 'check-email',
    lazy: () => import('@org/pages').then((m) => ({ Component: m.CheckEmailPage })),
  },
  {
    path: 'email-verified',
    lazy: () => import('@org/pages').then((m) => ({ Component: m.EmailVerifiedPage })),
  },
  {
    path: 'forgot-password',
    lazy: () => import('@org/pages').then((m) => ({ Component: m.ForgotPasswordPage })),
  },
  {
    path: 'reset-password',
    lazy: () => import('@org/pages').then((m) => ({ Component: m.ResetPasswordPage })),
  },
];
