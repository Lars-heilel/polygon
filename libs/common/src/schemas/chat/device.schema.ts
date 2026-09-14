import * as z from 'zod';

export const deviceSchema = z.object({
  userId: z.uuid(),
  deviceId: z.uuid(),
  identityKey: z.string().min(1),
  registrationId: z.number().int().nonnegative(),
});
export type DeviceRecord = z.infer<typeof deviceSchema>;

export const registerDeviceSchema = deviceSchema.pick({
  userId: true,
  deviceId: true,
  identityKey: true,
  registrationId: true,
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
