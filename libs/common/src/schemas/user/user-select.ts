export const USER_SELECT_FIELDS = {
  id: true,
  email: true,
  name: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type UserSelectFields = typeof USER_SELECT_FIELDS;
