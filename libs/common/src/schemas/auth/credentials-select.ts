// Full select — includes passwordHash and lock fields, for internal auth service use only
export const CREDENTIALS_FULL_SELECT_FIELDS = {
  id: true,
  email: true,
  role: true,
  passwordHash: true,
  isVerified: true,
  lockedAt: true,
  lockedUntil: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Safe select — no passwordHash, no lock fields, for cross-service responses
export const CREDENTIALS_SELECT_FIELDS = {
  id: true,
  email: true,
  role: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;
