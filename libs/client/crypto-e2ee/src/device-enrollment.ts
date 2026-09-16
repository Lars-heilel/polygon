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
 * Generate device keys, register them as this device's own keys (including
 * the one-time private halves, retained until each prekey is consumed),
 * and persist the device id. Returns the payloads for `DEVICE_REGISTER`
 * (deviceId, identityKey, registrationId) and `PREKEYS_PUBLISH` (deviceId,
 * signedPrekey, signedPrekeySignature, oneTimePrekeys). Network stays with
 * the caller so this package keeps no HTTP dependency.
 */
export async function prepareDeviceEnrollment(): Promise<DeviceEnrollment> {
  const deviceId = getOrCreateDeviceId();
  const { identityKeyPair, signedPrekeyPair, registrationId } = await generateDeviceKeys();
  const oneTimePairs = await Promise.all(
    Array.from({ length: ENROLLMENT_ONE_TIME_PREKEY_COUNT }, () =>
      crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']),
    ),
  );
  const oneTimePublics = await Promise.all(
    oneTimePairs.map((pair) => exportPublicKey(pair.publicKey)),
  );
  const oneTimePrivates = new Map<string, CryptoKey>(
    oneTimePairs.map((pair, index) => [oneTimePublics[index] as string, pair.privateKey]),
  );
  registerOwnDeviceKeys({
    deviceId,
    identityPrivate: identityKeyPair.privateKey,
    signedPrekeyPrivate: signedPrekeyPair.privateKey,
    oneTimePrivates,
  });
  rememberDeviceId(deviceId);
  return {
    deviceId,
    identityKey: await exportPublicKey(identityKeyPair.publicKey),
    registrationId,
    signedPrekey: await exportPublicKey(signedPrekeyPair.publicKey),
    signedPrekeySignature: ENROLLMENT_SIGNED_PREKEY_SIGNATURE,
    oneTimePrekeys: oneTimePublics,
  };
}
