import * as z from 'zod';

export const envelopeSchema = z.object({
  senderDeviceId: z.uuid(),
  recipientDeviceId: z.uuid(),
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  keyVersion: z.number().int().nonnegative(),
  ratchetHeader: z.string().min(1),
});
export type MessageEnvelope = z.infer<typeof envelopeSchema>;

export const groupEnvelopeSchema = z.object({
  senderDeviceId: z.uuid(),
  chainKeyId: z.string().min(1),
  counter: z.number().int().nonnegative(),
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
});
export type GroupMessageEnvelope = z.infer<typeof groupEnvelopeSchema>;
