export const USER_QUEUE = 'user_queue';
export const USER_CLIENT_TOKEN = 'USER_CLIENT';

export const USER_PATTERNS = {
  GET_BY_ID: 'user.getById',
  UPDATE: 'user.update',
} as const;

export const USER_EVENTS = {
  REGISTERED: 'user.registered',
} as const;
