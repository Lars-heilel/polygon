export const AUTH_QUEUE = 'auth_queue';
export const AUTH_CLIENT_TOKEN = 'AUTH_CLIENT';

export const AUTH_PATTERNS = {
  REGISTER: 'auth.register',
  GET_ROLE_BY_ID: 'auth.get-role-by-id',
  VALIDATE_CREDENTIALS: 'auth.validate-credentials',
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REFRESH: 'auth.refresh',
  VERIFY_EMAIL: 'auth.verify-email',
  RESEND_VERIFICATION: 'auth.resend-verification',
  FORGOT_PASSWORD: 'auth.forgot-password',
  RESET_PASSWORD: 'auth.reset-password',
  OAUTH_LOGIN: 'auth.oauth-login',
  LIST_SESSIONS: 'auth.list-sessions',
  REVOKE_SESSION: 'auth.revoke-session',
  REVOKE_ALL_SESSIONS: 'auth.revoke-all-sessions',
  GET_ADMIN_ACCOUNT: 'auth.admin.get-account',
  LIST_ADMIN_SESSIONS: 'auth.admin.list-sessions',
  REVOKE_ADMIN_SESSION: 'auth.admin.revoke-session',
  REVOKE_ALL_ADMIN_SESSIONS: 'auth.admin.revoke-all-sessions',
  BAN_ACCOUNT: 'auth.admin.ban-account',
  UNBAN_ACCOUNT: 'auth.admin.unban-account',
} as const;
