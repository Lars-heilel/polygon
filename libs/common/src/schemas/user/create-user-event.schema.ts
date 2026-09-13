import * as z from 'zod';

export const createUserEventSchema = z.object({
  id: z.uuid(),
  email: z.email().max(254),
  name: z.string().min(2).max(32),
});

export type CreateUserEventInput = z.infer<typeof createUserEventSchema>;
