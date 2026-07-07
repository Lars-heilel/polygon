export const API_ROUTES = {
  auth: {
    root: 'auth',
    register: 'auth/register',
    login: 'auth/login',
    logout: 'auth/logout',
    refresh: 'auth/refresh',
    forgotPassword: 'auth/forgot-password',
    resetPassword: 'auth/reset-password',
    resendVerification: 'auth/resend-verification',
  },
  users: {
    root: 'users',
    me: 'users/me',
    byId: (id: string) => `users/${id}`,
  },
  chats: {
    root: 'chats',
    direct: 'chats/direct',
    byId: (id: string) => `chats/${id}`,
    messages: (id: string) => `chats/${id}/messages`,
    mediaMessages: (id: string) => `chats/${id}/media/messages`,
  },
  search: {
    users: 'search/users',
  },
  media: {
    initUpload: 'media/init-upload',
    confirm: 'media/confirm',
    linkPreview: 'media/link-preview',
    fileUrl: (fileId: string) => `media/files/${fileId}/url`,
    delete: (id: string) => `media/${id}`,
    history: 'media/history',
    chatHistory: (chatId: string) => `chats/${chatId}/media/history`,
    userAvatars: (userId: string) => `users/${userId}/avatars`,
  },
} as const;

export const CLIENT_ROUTES = {
  root: '/',
  auth: {
    root: '/auth',
    login: '/auth/login',
    register: '/auth/register',
    checkEmail: '/auth/check-email',
    emailVerified: '/auth/email-verified',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },
  chats: {
    root: '/chats',
    byId: (id: string) => `/chats/${id}`,
  },
  settings: '/settings',
} as const;
