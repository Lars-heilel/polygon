export const NOTIFICATION_QUEUE = 'notification_queue';
export const NOTIFICATION_CLIENT_TOKEN = 'NOTIFICATION_CLIENT';

export const NOTIFICATION_EVENTS = {
  SEND_VERIFICATION_EMAIL: 'notification.send-verification-email',
  SEND_PASSWORD_RESET: 'notification.send-password-reset',
  SEND_PUSH: 'notification.send-push',
  PUSH_SUBSCRIBE: 'notification.push-subscribe',
  PUSH_UNSUBSCRIBE: 'notification.push-unsubscribe',
} as const;