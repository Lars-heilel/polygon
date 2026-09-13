import * as z from 'zod';

import { PASSWORD_REGEX } from '../../constants';

export const registerSchema = z.object({
  email: z.email().max(254),
  password: z
    .string()
    .regex(
      PASSWORD_REGEX,
      'Password must contain uppercase, lowercase, digits, and special characters (min 8 characters)',
    )
    .max(128),
  username: z.string().min(2).max(32),
});

export type RegisterInput = z.infer<typeof registerSchema>;
