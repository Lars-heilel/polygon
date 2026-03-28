export const AUTH_QUEUE = 'auth_queue';
export const AUTH_CLIENT_TOKEN = 'AUTH_CLIENT';

export const AUTH_PATTERNS = {
  REGISTER: 'auth.register',
  VALIDATE_CREDENTIALS: 'auth.validate-credentials',
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REFRESH: 'auth.refresh',
  VERIFY_EMAIL: 'auth.verify-email',
  RESEND_VERIFICATION: 'auth.resend-verification',
  FORGOT_PASSWORD: 'auth.forgot-password',
  RESET_PASSWORD: 'auth.reset-password',
  OAUTH_LOGIN: 'auth.oauth-login',
} as const;
