import * as z from 'zod';

export const adminBanDurationSchema = z.enum([
  'ONE_HOUR',
  'ONE_DAY',
  'SEVEN_DAYS',
  'THIRTY_DAYS',
  'PERMANENT',
]);

export const adminBanReasonSchema = z.enum([
  'SPAM',
  'BULLYING',
  'UNACCEPTABLE_CONTENT',
  'SUSPICIOUS_ACTIVITY',
  'CUSTOM',
]);

export const adminBanRequestSchema = z.discriminatedUnion('reason', [
  z.object({
    duration: adminBanDurationSchema,
    reason: z.literal('CUSTOM'),
    customReason: z.string().trim().min(5).max(500),
  }),
  z.object({
    duration: adminBanDurationSchema,
    reason: adminBanReasonSchema.exclude(['CUSTOM']),
    customReason: z.never().optional(),
  }),
]);

export const adminBanStateSchema = z.object({
  isBanned: z.boolean(),
  bannedUntil: z.coerce.date().nullable(),
  banReason: z.string().nullable(),
  bannedAt: z.coerce.date().nullable(),
  bannedBy: z.string().nullable(),
});

export type AdminBanDuration = z.infer<typeof adminBanDurationSchema>;
export type AdminBanReason = z.infer<typeof adminBanReasonSchema>;
export type AdminBanRequest = z.infer<typeof adminBanRequestSchema>;
export type AdminBanState = z.infer<typeof adminBanStateSchema>;
