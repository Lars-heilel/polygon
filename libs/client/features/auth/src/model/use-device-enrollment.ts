import { API_ROUTES, type DeviceRecord } from '@org/common';
import {
  clearOwnDeviceKeys,
  getOwnDeviceKeys,
  prepareDeviceEnrollment,
  resetDeviceId,
} from '@org/crypto-e2ee';
import { ApiError, authedFetch, frontendLog, queryClient } from '@org/shared';

let enrollInflight: Promise<void> | null = null;

/**
 * Ensure this browser holds a server-registered device for the current user.
 * Verifies the local device against the server instead of trusting local
 * storage: after a server wipe, an account switch, or an OAuth login (which
 * never enrolled), the local keys are stale or missing and we enroll fresh.
 * Safe to call from every auth path (login, register, OAuth callback,
 * session restore) — concurrent calls share one flight.
 */
export function ensureDeviceEnrolled(): Promise<void> {
  if (!enrollInflight) {
    enrollInflight = ensure().finally(() => {
      enrollInflight = null;
    });
  }
  return enrollInflight;
}

async function ensure(): Promise<void> {
  try {
    const me = queryClient.getQueryData<{ id: string }>(['me']);
    if (!me?.id) {
      frontendLog('debug', 'DeviceEnrollment', 'device_ensure_skipped', {
        hasUser: false,
      });
      return;
    }

    const own = getOwnDeviceKeys();
    if (own) {
      const verdict = await verifyOwnDevice(own.deviceId, me.id);
      if (verdict === 'verified') return;
      if (verdict === 'transient') return;
      // 'missing' or 'foreign': drop stale keys and enroll fresh below.
      clearOwnDeviceKeys();
      if (verdict === 'foreign') resetDeviceId();
    }

    await enrollDevice();
  } catch {
    frontendLog('warn', 'DeviceEnrollment', 'device_ensure_failed', {});
  }
}

type VerifyVerdict = 'verified' | 'missing' | 'foreign' | 'transient';

async function verifyOwnDevice(deviceId: string, userId: string): Promise<VerifyVerdict> {
  try {
    const record = await authedFetch<DeviceRecord>(API_ROUTES.chats.deviceById(deviceId));
    if (record.userId === userId) {
      frontendLog('debug', 'DeviceEnrollment', 'device_enroll_verified', {
        hasDeviceId: true,
      });
      return 'verified';
    }
    frontendLog('warn', 'DeviceEnrollment', 'device_owner_mismatch', {
      hasDeviceId: true,
    });
    return 'foreign';
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      frontendLog('debug', 'DeviceEnrollment', 'device_enroll_missing', {
        hasDeviceId: true,
      });
      return 'missing';
    }
    frontendLog('warn', 'DeviceEnrollment', 'device_verify_transient', {
      hasDeviceId: true,
    });
    return 'transient';
  }
}

async function enrollDevice(): Promise<void> {
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
}
