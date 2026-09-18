import { ApiError } from '@org/shared';
import { queryClient } from '@org/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureDeviceEnrolled } from '../use-device-enrollment.js';

const cryptoMocks = vi.hoisted(() => ({
  getOwnDeviceKeys: vi.fn(),
  clearOwnDeviceKeys: vi.fn(),
  resetDeviceId: vi.fn(() => 'fresh-device-id'),
  prepareDeviceEnrollment: vi.fn(),
  loadPersistedDeviceKeys: vi.fn(),
  registerOwnDeviceKeys: vi.fn(),
  clearPersistedDeviceKeys: vi.fn(),
}));

const sharedMocks = vi.hoisted(() => ({
  authedFetch: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  me: vi.fn(),
}));

vi.mock('@org/crypto-e2ee', () => cryptoMocks);
vi.mock('@org/entities-user', () => ({
  authApi: { me: userMocks.me },
}));
vi.mock('@org/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@org/shared')>()),
  authedFetch: sharedMocks.authedFetch,
  frontendLog: vi.fn(),
}));

const ME_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c0';
const DEVICE_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1';

function seedMe() {
  queryClient.setQueryData(['me'], { id: ME_ID });
}

function seedOwnKeys() {
  cryptoMocks.getOwnDeviceKeys.mockReturnValue({ deviceId: DEVICE_ID });
}

function seedEnrollment() {
  cryptoMocks.prepareDeviceEnrollment.mockResolvedValue({
    deviceId: DEVICE_ID,
    identityKey: 'aWtlaQ==',
    registrationId: 7,
    signedPrekey: 'c3Bn',
    signedPrekeySignature: 'c2ln',
    oneTimePrekeys: ['b3Rw'],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
  userMocks.me.mockResolvedValue(null);
  cryptoMocks.loadPersistedDeviceKeys.mockResolvedValue(null);
  seedEnrollment();
});

describe('ensureDeviceEnrolled', () => {
  it('skips without any fetch when no user session exists', async () => {
    cryptoMocks.getOwnDeviceKeys.mockReturnValue(null);

    await ensureDeviceEnrolled();

    expect(userMocks.me).toHaveBeenCalled();
    expect(sharedMocks.authedFetch).not.toHaveBeenCalled();
  });

  it('resolves the user via live call when the cache is empty', async () => {
    cryptoMocks.getOwnDeviceKeys.mockReturnValue(null);
    userMocks.me.mockResolvedValueOnce({ id: ME_ID });
    sharedMocks.authedFetch.mockResolvedValue(undefined);

    await ensureDeviceEnrolled();

    expect(sharedMocks.authedFetch).toHaveBeenCalledWith(
      expect.stringContaining('chats/devices'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('verifies an enrolled device without re-registering', async () => {
    seedMe();
    seedOwnKeys();
    sharedMocks.authedFetch.mockResolvedValueOnce({
      deviceId: DEVICE_ID,
      userId: ME_ID,
      identityKey: 'aWtlaQ==',
      registrationId: 7,
    });

    await ensureDeviceEnrolled();

    expect(sharedMocks.authedFetch).toHaveBeenCalledTimes(1);
    expect(cryptoMocks.clearOwnDeviceKeys).not.toHaveBeenCalled();
  });

  it('re-enrolls with the same id when the server record is missing (404)', async () => {
    seedMe();
    seedOwnKeys();
    sharedMocks.authedFetch.mockRejectedValueOnce(new ApiError(404, null));
    sharedMocks.authedFetch.mockResolvedValue(undefined);

    await ensureDeviceEnrolled();

    expect(cryptoMocks.clearOwnDeviceKeys).toHaveBeenCalled();
    expect(cryptoMocks.resetDeviceId).not.toHaveBeenCalled();
    const posts = sharedMocks.authedFetch.mock.calls.filter(([, init]) => init?.method === 'POST');
    const puts = sharedMocks.authedFetch.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(posts).toHaveLength(1);
    expect(puts).toHaveLength(1);
  });

  it('mints a fresh id when the stored device belongs to another user', async () => {
    seedMe();
    seedOwnKeys();
    sharedMocks.authedFetch.mockResolvedValueOnce({
      deviceId: DEVICE_ID,
      userId: 'someone-else',
      identityKey: 'aWtlaQ==',
      registrationId: 7,
    });
    sharedMocks.authedFetch.mockResolvedValue(undefined);

    await ensureDeviceEnrolled();

    expect(cryptoMocks.resetDeviceId).toHaveBeenCalled();
    expect(sharedMocks.authedFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('hydrates persisted keys after a reload instead of re-enrolling', async () => {
    seedMe();
    cryptoMocks.getOwnDeviceKeys.mockReturnValue(null);
    cryptoMocks.loadPersistedDeviceKeys.mockResolvedValueOnce({ deviceId: DEVICE_ID });
    sharedMocks.authedFetch.mockResolvedValueOnce({
      deviceId: DEVICE_ID,
      userId: ME_ID,
      identityKey: 'aWtlaQ==',
      registrationId: 7,
    });

    await ensureDeviceEnrolled();

    expect(cryptoMocks.registerOwnDeviceKeys).toHaveBeenCalled();
    const posts = sharedMocks.authedFetch.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(0);
  });

  it('enrolls fresh when verified by nothing recoverable (pre-fix client)', async () => {
    seedMe();
    cryptoMocks.getOwnDeviceKeys.mockReturnValue(null);
    cryptoMocks.loadPersistedDeviceKeys.mockResolvedValueOnce(null);
    sharedMocks.authedFetch.mockResolvedValue(undefined);

    await ensureDeviceEnrolled();

    const posts = sharedMocks.authedFetch.mock.calls.filter(([, init]) => init?.method === 'POST');
    const puts = sharedMocks.authedFetch.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(posts).toHaveLength(1);
    expect(puts).toHaveLength(1);
  });

  it('enrolls directly when no local keys exist', async () => {
    seedMe();
    cryptoMocks.getOwnDeviceKeys.mockReturnValue(null);
    sharedMocks.authedFetch.mockResolvedValue(undefined);

    await ensureDeviceEnrolled();

    expect(sharedMocks.authedFetch).toHaveBeenCalledWith(
      expect.stringContaining('chats/devices'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('refreshes server state once keys are ready (verified path)', async () => {
    seedMe();
    seedOwnKeys();
    sharedMocks.authedFetch.mockResolvedValueOnce({
      deviceId: DEVICE_ID,
      userId: ME_ID,
      identityKey: 'aWtlaQ==',
      registrationId: 7,
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    try {
      await ensureDeviceEnrolled();

      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messages'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['chats'] });
    } finally {
      invalidate.mockRestore();
    }
  });

  it('refreshes server state after a fresh enrollment', async () => {
    seedMe();
    cryptoMocks.getOwnDeviceKeys.mockReturnValue(null);
    sharedMocks.authedFetch.mockResolvedValue(undefined);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    try {
      await ensureDeviceEnrolled();

      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messages'] });
    } finally {
      invalidate.mockRestore();
    }
  });
  it('does nothing on transient verify failures (no wipe, no enroll)', async () => {
    seedMe();
    seedOwnKeys();
    sharedMocks.authedFetch.mockRejectedValueOnce(new Error('NETWORK_DOWN'));

    await ensureDeviceEnrolled();

    expect(cryptoMocks.clearOwnDeviceKeys).not.toHaveBeenCalled();
    expect(sharedMocks.authedFetch).toHaveBeenCalledTimes(1);
  });
});
