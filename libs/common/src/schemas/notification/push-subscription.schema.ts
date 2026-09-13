import * as z from 'zod';

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048),
  p256dh: z.string().min(1).max(128),
  auth: z.string().min(1).max(128),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushSubscribeEventSchema = z.object({
  userId: z.uuid(),
  subscription: pushSubscriptionSchema,
});
export type PushSubscribeEventInput = z.infer<typeof pushSubscribeEventSchema>;

export const pushUnsubscribeEventSchema = z.object({
  userId: z.uuid(),
  endpoint: z.url().max(2048),
});
export type PushUnsubscribeEventInput = z.infer<typeof pushUnsubscribeEventSchema>;
