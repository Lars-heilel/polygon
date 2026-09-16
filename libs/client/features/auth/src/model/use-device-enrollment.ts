import { API_ROUTES } from '@org/common';
import { getOwnDeviceKeys, prepareDeviceEnrollment } from '@org/crypto-e2ee';
import { authedFetch, frontendLog } from '@org/shared';

let enrollInflight: Promise<void> | null = null;

/**
 * Device enrollment at login: generate device keys → `DEVICE_REGISTER`
 * → `PREKEYS_PUBLISH` (existing Gateway routes + `API_ROUTES`), and store
 * the device id that `senderDeviceId` resolves from. Fire-and-forget from
 * the login flow; failures never block navigation.
 */
export function enrollDeviceAfterLogin(): Promise<void> {
  if (!enrollInflight) {
    enrollInflight = enrollDevice().finally(() => {
      enrollInflight = null;
    });
  }
  return enrollInflight;
}

async function enrollDevice(): Promise<void> {
  try {
    if (getOwnDeviceKeys()) {
      frontendLog('debug', 'DeviceEnrollment', 'device_enroll_skipped', {
        hasDeviceId: true,
      });
      return;
    }
    frontendLog('debug', 'DeviceEnrollment', 'device_enroll_requested', {});
    const enrollment = await prepareDeviceEnrollment();
    await authedFetch<void>(API_ROUTES.chats.devices, {
      method: 'POST',
      body: JSON.stringify({
        deviceId: enrollment.deviceId,
        identityKey: enrollment.identityKey,
        registrationId: enrollment.registrationId,
      }),
    });
    await authedFetch<void>(API_ROUTES.chats.prekeys(enrollment.deviceId), {
      method: 'PUT',
      body: JSON.stringify({
        deviceId: enrollment.deviceId,
        signedPrekey: enrollment.signedPrekey,
        signedPrekeySignature: enrollment.signedPrekeySignature,
        oneTimePrekeys: enrollment.oneTimePrekeys,
      }),
    });
    frontendLog('debug', 'DeviceEnrollment', 'device_enroll_done', {
      hasDeviceId: !!enrollment.deviceId,
    });
  } catch {
    frontendLog('warn', 'DeviceEnrollment', 'device_enroll_failed', {});
  }
}
