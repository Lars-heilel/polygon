import * as z from 'zod';

/**
 * Fail-closed error code for group sends in E2EE chats: the sender could
 * not discover any recipient device keys, so the message must not silently
 * fall back to plaintext.
 */
export const E2EE_NO_RECIPIENT_KEYS = 'E2EE_NO_RECIPIENT_KEYS';

export const senderKeyDistributionSchema = z.object({
  chatId: z.uuid(),
  chainKeyId: z.uuid(),
  senderDeviceId: z.uuid(),
  recipientDeviceId: z.uuid(),
  wrappedChainKey: z.string().min(1),
});
export type SenderKeyDistribution = z.infer<typeof senderKeyDistributionSchema>;
