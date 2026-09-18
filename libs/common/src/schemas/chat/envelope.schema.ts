import * as z from 'zod';

/**
 * Per-file content keys for encrypted attachments. The file bytes in MinIO
 * are AES-GCM ciphertext; only holders of a message envelope can recover
 * the key. `fileName`/`mime` travel here (never in server-side snapshots),
 * so the server learns nothing but opaque bytes, sizes, and categories.
 */
export const envelopeFileKeySchema = z.object({
  mediaId: z.string().min(1),
  key: z.string().min(1),
  iv: z.string().min(1),
  fileName: z.string().min(1),
  mime: z.string().min(1),
});
export type EnvelopeFileKey = z.infer<typeof envelopeFileKeySchema>;

export const envelopeSchema = z.object({
  senderDeviceId: z.uuid(),
  recipientDeviceId: z.uuid(),
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  keyVersion: z.number().int().nonnegative(),
  ratchetHeader: z.string().min(1),
  ephemeralKey: z.string().min(1),
  fileKeys: z.array(envelopeFileKeySchema).max(10).optional(),
});
export type MessageEnvelope = z.infer<typeof envelopeSchema>;

export const groupEnvelopeSchema = z.object({
  senderDeviceId: z.uuid(),
  chainKeyId: z.string().min(1),
  counter: z.number().int().nonnegative(),
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  fileKeys: z.array(envelopeFileKeySchema).max(10).optional(),
});
export type GroupMessageEnvelope = z.infer<typeof groupEnvelopeSchema>;
