import * as z from 'zod';

export const prekeyBundleSchema = z.object({
  deviceId: z.uuid(),
  identityKey: z.string().min(1),
  signedPrekey: z.string().min(1),
  signedPrekeySignature: z.string().min(1),
  oneTimePrekey: z.string().min(1).nullable(),
});
export type PrekeyBundleRecord = z.infer<typeof prekeyBundleSchema>;

export const publishPrekeysSchema = z.object({
  deviceId: z.uuid(),
  signedPrekey: z.string().min(1),
  signedPrekeySignature: z.string().min(1),
  oneTimePrekeys: z.array(z.string().min(1)).max(100),
});
export type PublishPrekeysInput = z.infer<typeof publishPrekeysSchema>;
