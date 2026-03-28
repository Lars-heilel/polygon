// Full select — all fields, for server-to-server interactions
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

// Public select — safe to expose to clients (no email, no timestamps)
export const USER_PUBLIC_SELECT_FIELDS = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
} as const;
