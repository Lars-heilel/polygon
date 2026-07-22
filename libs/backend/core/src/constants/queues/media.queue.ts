export const MEDIA_QUEUE = 'media_queue';
export const MEDIA_CLIENT_TOKEN = 'MEDIA_CLIENT';

export const MEDIA_PATTERNS = {
  INIT_UPLOAD: 'media.initUpload',
  CONFIRM_UPLOAD: 'media.confirmUpload',
  GET_BY_ID: 'media.getById',
  GET_FILE_URL: 'media.getFileUrl',
  GET_FILE_CONTENT: 'media.getFileContent',
  DELETE: 'media.delete',
  GET_HISTORY: 'media.getHistory',
  GET_ADMIN_AVATAR_HISTORY: 'media.admin.getAvatarHistory',
  GET_CHAT_HISTORY: 'media.getChatHistory',
  CREATE_FILE: 'media.createFile',
  CREATE_REFERENCE: 'media.references.create',
  DELETE_REFERENCE: 'media.references.delete',
  COUNT_REFERENCES: 'media.references.count',
} as const;
