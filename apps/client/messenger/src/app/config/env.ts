import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL:    z.url().optional(),
  VITE_SOCKET_URL: z.url().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error('[env] Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(` ${issue.path.join('.')}: ${issue.message}`);
  }
  throw new Error('Invalid environment variables — check console for details');
}

export const env = parsed.data;
