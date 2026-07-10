import * as z from 'zod';

export const frontendErrorSchema = z.object({
  app: z.enum(['messenger', 'admin']),
  route: z.string().max(2048),
  message: z.string().max(4096),
  stack: z.string().max(20000).optional(),
  componentStack: z.string().max(20000).optional(),
  userAgent: z.string().max(1024).optional(),
  timestamp: z.string().datetime(),
});

export type FrontendErrorPayload = z.infer<typeof frontendErrorSchema>;
