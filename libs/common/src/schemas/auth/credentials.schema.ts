import * as z from 'zod';
import { roleSchema } from './role.schema';

export const credentialsSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: roleSchema,
  passwordHash: z.string(),
  isVerified: z.boolean(),
  lockedAt: z.date().nullable(),
  lockedUntil: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
