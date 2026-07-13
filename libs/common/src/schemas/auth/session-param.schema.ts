import * as z from 'zod';

export const sessionIdParamSchema = z.object({
  id: z.uuid(),
});

export type SessionIdParamInput = z.infer<typeof sessionIdParamSchema>;
