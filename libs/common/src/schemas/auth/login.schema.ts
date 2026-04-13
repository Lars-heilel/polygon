import * as z from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, 'Password is required').default('Pa$$word1'),
});
