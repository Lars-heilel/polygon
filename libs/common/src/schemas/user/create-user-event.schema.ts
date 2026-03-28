import * as z from 'zod';

export const createUserEventSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
});

export type CreateUserEventInput = z.infer<typeof createUserEventSchema>;
