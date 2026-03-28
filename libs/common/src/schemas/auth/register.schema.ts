import * as z from 'zod';
import { PASSWORD_REGEX } from '../../constants';

export const registerSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .regex(
      PASSWORD_REGEX,
      'Password must contain uppercase, lowercase, digits, and special characters (min 8 characters)'
    ),
  username: z.string().min(2),
});

export type RegisterInput = z.infer<typeof registerSchema>;
