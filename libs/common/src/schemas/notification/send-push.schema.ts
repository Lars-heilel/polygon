import * as z from 'zod';

export const notificationEventTypeSchema = z.enum(['MESSAGE', 'CALL_INCOMING', 'CALL_MISSED']);
export type NotificationEventType = z.infer<typeof notificationEventTypeSchema>;

export const sendPushSchema = z.object({
  userId: z.uuid(),
  title: z.string().min(1).max(128),
  body: z.string().min(1).max(512),
  icon: z.url().max(2048).optional(),
  tag: z.string().max(128).optional(),
  eventType: notificationEventTypeSchema.optional(),
});
export type SendPushInput = z.infer<typeof sendPushSchema>;
