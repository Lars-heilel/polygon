export const CREDENTIALS_SELECT_FIELDS = {
  id: true,
  email: true,
  role: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type CredentialsSelectFields = typeof CREDENTIALS_SELECT_FIELDS;
