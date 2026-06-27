import * as z from 'zod';

export const roleSchema = z.enum(['CREATOR', 'ADMIN', 'MODERATOR', 'USER']);
export type Role = z.infer<typeof roleSchema>;
