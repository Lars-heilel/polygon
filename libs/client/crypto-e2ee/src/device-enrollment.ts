import {
  exportPublicKey,
  generateDeviceKeys,
  getOrCreateDeviceId,
  registerOwnDeviceKeys,
  rememberDeviceId,
} from './device-keys.js';

export const ENROLLMENT_ONE_TIME_PREKEY_COUNT = 20;
/** Placeholder signature: ECDH keys cannot sign; verify is skipped server-side. */
export const ENROLLMENT_SIGNED_PREKEY_SIGNATURE = 'c2ln';

export interface DeviceEnrollment {
  deviceId: string;
  identityKey: string;
  registrationId: number;
  signedPrekey: string;
  signedPrekeySignature: string;
  oneTimePrekeys: string[];
}

/**
 * Generate device keys, register them as this device's own keys, and persist
 * the device id. Returns the payloads for `DEVICE_REGISTER` (deviceId,
 * identityKey, registrationId) and `PREKEYS_PUBLISH` (deviceId, signedPrekey,
 * signedPrekeySignature, oneTimePrekeys). Network stays with the caller so
 * this package keeps no HTTP dependency.
 */
export async function prepareDeviceEnrollment(): Promise<DeviceEnrollment> {
  const deviceId = getOrCreateDeviceId();
  const { identityKeyPair, signedPrekeyPair, registrationId } = await generateDeviceKeys();
  const oneTimePairs = await Promise.all(
    Array.from({ length: ENROLLMENT_ONE_TIME_PREKEY_COUNT }, () =>
      crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']),
    ),
  );
  registerOwnDeviceKeys({
    deviceId,
    identityPrivate: identityKeyPair.privateKey,
    signedPrekeyPrivate: signedPrekeyPair.privateKey,
  });
  rememberDeviceId(deviceId);
  return {
    deviceId,
    identityKey: await exportPublicKey(identityKeyPair.publicKey),
    registrationId,
    signedPrekey: await exportPublicKey(signedPrekeyPair.publicKey),
    signedPrekeySignature: ENROLLMENT_SIGNED_PREKEY_SIGNATURE,
    oneTimePrekeys: await Promise.all(oneTimePairs.map((pair) => exportPublicKey(pair.publicKey))),
  };
}
