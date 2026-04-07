export const USER_QUEUE = 'user_queue';
export const USER_CLIENT_TOKEN = 'USER_CLIENT';

export const USER_PATTERNS = {
  GET_BY_ID: 'user.getById',
  GET_PUBLIC_BY_ID: 'user.getPublicById',
  GET_ALL_PUBLIC: 'user.getAllPublic',
  UPDATE: 'user.update',
} as const;

export const USER_EVENTS = {
  REGISTERED: 'user.registered',
  UPDATED: 'user.updated',
  DELETED: 'user.deleted',
} as const;
