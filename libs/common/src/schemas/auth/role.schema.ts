import * as z from 'zod';

export const roleSchema = z.enum(['ADMIN', 'MODERATOR', 'USER']);
export type Role = z.infer<typeof roleSchema>;
