import { z } from 'zod';

import { frontendLog } from '@org/shared';

const envSchema = z.object({
  VITE_API_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  if (import.meta.env.DEV) {
    frontendLog('error', 'Env', 'invalid_env', { issueCount: parsed.error.issues.length });
  }
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
