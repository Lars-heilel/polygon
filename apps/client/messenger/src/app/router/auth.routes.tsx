import { RouteObject } from 'react-router';

export const authRoutes: RouteObject[] = [
  {
    path: 'login',
    lazy: () => import('@org/pages-login').then((m) => ({ Component: m.LoginPage })),
  },
  {
    path: 'register',
    lazy: () => import('@org/pages-register').then((m) => ({ Component: m.RegisterPage })),
  },
  {
    path: 'check-email',
    lazy: () => import('@org/pages-check-email').then((m) => ({ Component: m.CheckEmailPage })),
  },
  {
    path: 'email-verified',
    lazy: () =>
      import('@org/pages-email-verified').then((m) => ({ Component: m.EmailVerifiedPage })),
  },
  {
    path: 'forgot-password',
    lazy: () =>
      import('@org/pages-forgot-password').then((m) => ({ Component: m.ForgotPasswordPage })),
  },
  {
    path: 'reset-password',
    lazy: () =>
      import('@org/pages-reset-password').then((m) => ({ Component: m.ResetPasswordPage })),
  },
];
