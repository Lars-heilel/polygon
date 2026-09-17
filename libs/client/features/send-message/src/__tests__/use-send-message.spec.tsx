import type { Chat, DeviceRecord, PrekeyBundleRecord } from '@org/common';
import {
  createRecipientSession,
  decryptFromDevice,
  decryptFromGroup,
  getActiveDeviceId,
  registerOwnDeviceKeys,
} from '@org/crypto-e2ee';
import { queryClient } from '@org/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildGroupEnvelopes, buildMessageEnvelopes, useSendMessage } from '../use-send-message.js';

const { mockSocket, mockAuthedFetch } = vi.hoisted(() => ({
  mockSocket: { emit: vi.fn() },
  mockAuthedFetch: vi.fn(),
}));

vi.mock('@org/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/shared')>();
  return { ...actual, socket: mockSocket, authedFetch: mockAuthedFetch };
});

const SENDER_DEVICE = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c0';
const CHAT_DIRECT = 'send-chat-direct-1';
const CHAT_GROUP = 'send-chat-group-1';

const genKey = () =>
  crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const exportPub = async (key: CryptoKey) =>
  btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', key))));

interface RemoteDevice {
  deviceId: string;
  identity: CryptoKeyPair;
  signed: CryptoKeyPair;
}

async function makeRemoteDevice(deviceId: string): Promise<RemoteDevice> {
  return {
    deviceId,
    identity: await genKey(),
    signed: await genKey(),
  };
}

async function bundleFor(device: RemoteDevice): Promise<PrekeyBundleRecord> {
  return {
    deviceId: device.deviceId,
    identityKey: await exportPub(device.identity.publicKey),
    signedPrekey: await exportPub(device.signed.publicKey),
    signedPrekeySignature: 'c2ln',
    oneTimePrekey: null,
  };
}

function deviceRecord(deviceId: string, userId: string): DeviceRecord {
  return { userId, deviceId, identityKey: 'aWtlaQ==', registrationId: 7 };
}

/** Routes authedFetch by URL: chat-devices list, prekey bundles, share store. */
function routeFetch(opts: {
  devices: DeviceRecord[];
  bundles: Map<string, PrekeyBundleRecord>;
  sharePosts: unknown[];
}) {
  mockAuthedFetch.mockImplementation(async (url: string) => {
    if (url.endsWith('/devices')) return opts.devices;
    if (url.endsWith('/sender-keys')) {
      opts.sharePosts.push(url);
      return { ok: true };
    }
    const prekeyMatch = url.match(/devices\/([^/]+)\/prekeys$/);
    if (prekeyMatch) return opts.bundles.get(prekeyMatch[1] as string) ?? null;
    throw new Error(`unexpected fetch: ${url}`);
  });
}

function seedChats(chats: Chat[]): void {
  queryClient.setQueryData(['chats'], chats);
}

function chatRecord(overrides: Partial<Chat> & { id: string }): Chat {
  return {
    type: 'DIRECT',
    name: null,
    avatarUrl: null,
    selfOwnerId: null,
    directKey: null,
    e2eeEnabled: false,
    lastMessageId: null,
    lastMessageAt: null,
    createdAt: new Date('2026-09-16T10:00:00.000Z'),
    updatedAt: new Date('2026-09-16T10:00:00.000Z'),
    ...overrides,
  } as Chat;
}

beforeEach(async () => {
  mockSocket.emit.mockClear();
  mockAuthedFetch.mockReset();
  queryClient.clear();
  const senderKeys = await genKey();
  const senderSigned = await genKey();
  registerOwnDeviceKeys({
    deviceId: SENDER_DEVICE,
    identityPrivate: senderKeys.privateKey,
    signedPrekeyPrivate: senderSigned.privateKey,
  });
  expect(getActiveDeviceId().deviceId).toBe(SENDER_DEVICE);
});

describe('buildMessageEnvelopes', () => {
  it('establishes a session for a new recipient via bundle consume', async () => {
    const recipient = await makeRemoteDevice('0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1');
    const bundles = new Map([[recipient.deviceId, await bundleFor(recipient)]]);
    routeFetch({
      devices: [deviceRecord(SENDER_DEVICE, 'user-1'), deviceRecord(recipient.deviceId, 'user-2')],
      bundles,
      sharePosts: [],
    });
    seedChats([chatRecord({ id: CHAT_DIRECT, e2eeEnabled: true })]);

    const envelopes = await buildMessageEnvelopes(CHAT_DIRECT, 'hello new', SENDER_DEVICE, {
      e2eeEnabled: true,
    });

    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]?.recipientDeviceId).toBe(recipient.deviceId);
    const recipientSession = await createRecipientSession({
      ephemeralKeyB64: envelopes[0]?.ephemeralKey as string,
      ownIdentityPrivate: recipient.identity.privateKey,
      ownSignedPrekeyPrivate: recipient.signed.privateKey,
      theirDeviceId: SENDER_DEVICE,
    });
    await expect(decryptFromDevice(envelopes[0]!, recipientSession)).resolves.toBe('hello new');
    expect(mockAuthedFetch).toHaveBeenCalledWith(expect.stringMatching(/devices\/.*\/prekeys$/));
  });

  it('reuses cached sessions without consuming a bundle again', async () => {
    const recipient = await makeRemoteDevice('0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c5');
    const bundles = new Map([[recipient.deviceId, await bundleFor(recipient)]]);
    routeFetch({
      devices: [deviceRecord(SENDER_DEVICE, 'user-1'), deviceRecord(recipient.deviceId, 'user-2')],
      bundles,
      sharePosts: [],
    });

    await buildMessageEnvelopes('send-chat-reuse-1', 'one', SENDER_DEVICE);
    const prekeyCallsAfterFirst = mockAuthedFetch.mock.calls.filter(([url]) =>
      (url as string).includes('/prekeys'),
    ).length;
    await buildMessageEnvelopes('send-chat-reuse-1', 'two', SENDER_DEVICE);
    const prekeyCallsAfterSecond = mockAuthedFetch.mock.calls.filter(([url]) =>
      (url as string).includes('/prekeys'),
    ).length;

    // Two fetches on a fresh build: own bundle (null here, skipped) + peer.
    // Second build reuses the cached peer session; only the missing own
    // bundle is refetched.
    expect(prekeyCallsAfterFirst).toBe(2);
    expect(prekeyCallsAfterSecond).toBe(3);
  });

  it('throws E2EE_NO_RECIPIENT_KEYS for E2EE chats with no recipients', async () => {
    routeFetch({
      devices: [deviceRecord(SENDER_DEVICE, 'user-1')],
      bundles: new Map(),
      sharePosts: [],
    });

    await expect(
      buildMessageEnvelopes('send-chat-empty-1', 'hi', SENDER_DEVICE, { e2eeEnabled: true }),
    ).rejects.toThrow('E2EE_NO_RECIPIENT_KEYS');
  });

  it('keeps legacy empty behavior for non-E2EE chats', async () => {
    routeFetch({
      devices: [deviceRecord(SENDER_DEVICE, 'user-1')],
      bundles: new Map(),
      sharePosts: [],
    });

    await expect(buildMessageEnvelopes('send-chat-empty-2', 'hi', SENDER_DEVICE)).resolves.toEqual(
      [],
    );
  });
});

describe('buildGroupEnvelopes', () => {
  it('distributes sender-key shares and builds a decryptable group envelope', async () => {
    const recipientA = await makeRemoteDevice('0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c6');
    const recipientB = await makeRemoteDevice('0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c7');
    const sharePosts: unknown[] = [];
    const postedShares: unknown[] = [];
    const bundles = new Map([
      [recipientA.deviceId, await bundleFor(recipientA)],
      [recipientB.deviceId, await bundleFor(recipientB)],
    ]);
    mockAuthedFetch.mockImplementation(async (url: string, init?: { body?: string }) => {
      if (url.endsWith('/devices')) {
        return [
          deviceRecord(SENDER_DEVICE, 'user-1'),
          deviceRecord(recipientA.deviceId, 'user-2'),
          deviceRecord(recipientB.deviceId, 'user-3'),
        ];
      }
      if (url.endsWith('/sender-keys')) {
        sharePosts.push(url);
        postedShares.push(JSON.parse(init?.body as string));
        return { ok: true };
      }
      const prekeyMatch = url.match(/devices\/([^/]+)\/prekeys$/);
      if (prekeyMatch) return bundles.get(prekeyMatch[1] as string) ?? null;
      throw new Error(`unexpected fetch: ${url}`);
    });

    const envelopes = await buildGroupEnvelopes(CHAT_GROUP, 'hello group', SENDER_DEVICE, {
      e2eeEnabled: true,
    });

    expect(envelopes).toHaveLength(1);
    expect(sharePosts).toHaveLength(2);
    expect(postedShares).toHaveLength(2);
    for (const share of postedShares as { wrappedChainKey: string }[]) {
      expect(() => JSON.parse(share.wrappedChainKey)).not.toThrow();
    }
    await expect(decryptFromGroup(envelopes[0]!)).resolves.toBe('hello group');
  });
});

describe('useSendMessage composer', () => {
  it('surfaces E2EE_NO_RECIPIENT_KEYS without plaintext fallback in E2EE chats', async () => {
    routeFetch({
      devices: [deviceRecord(SENDER_DEVICE, 'user-1')],
      bundles: new Map(),
      sharePosts: [],
    });
    seedChats([chatRecord({ id: 'send-chat-composer-e2ee', type: 'DIRECT', e2eeEnabled: true })]);

    const { result } = renderHook(() => useSendMessage('send-chat-composer-e2ee', 'user-1'));
    act(() => {
      result.current.setMessageText('secret');
    });
    await act(async () => {
      await result.current.handleSend();
    });

    expect(result.current.sendError).toBe('E2EE_NO_RECIPIENT_KEYS');
    const plaintextEmits = mockSocket.emit.mock.calls.filter(
      ([, payload]) => (payload as { text?: string }).text === 'secret',
    );
    expect(plaintextEmits).toHaveLength(0);
  });

  it('keeps plaintext fallback for non-E2EE chats', async () => {
    routeFetch({
      devices: [deviceRecord(SENDER_DEVICE, 'user-1')],
      bundles: new Map(),
      sharePosts: [],
    });
    seedChats([chatRecord({ id: 'send-chat-composer-plain', type: 'DIRECT' })]);

    const { result } = renderHook(() => useSendMessage('send-chat-composer-plain', 'user-1'));
    act(() => {
      result.current.setMessageText('plain hi');
    });
    await act(async () => {
      await result.current.handleSend();
    });

    expect(result.current.sendError).toBeNull();
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'message:send',
      expect.objectContaining({ text: 'plain hi' }),
    );
  });

  it('emits group envelopes for E2EE group chats', async () => {
    const recipient = await makeRemoteDevice('0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c8');
    const bundles = new Map([[recipient.deviceId, await bundleFor(recipient)]]);
    routeFetch({
      devices: [deviceRecord(SENDER_DEVICE, 'user-1'), deviceRecord(recipient.deviceId, 'user-2')],
      bundles,
      sharePosts: [],
    });
    seedChats([chatRecord({ id: 'send-chat-composer-group', type: 'GROUP', e2eeEnabled: true })]);

    const { result } = renderHook(() => useSendMessage('send-chat-composer-group', 'user-1'));
    act(() => {
      result.current.setMessageText('group hi');
    });
    await act(async () => {
      await result.current.handleSend();
    });

    expect(result.current.sendError).toBeNull();
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'message:send',
      expect.objectContaining({ envelopes: expect.any(Array) }),
    );
    const payload = mockSocket.emit.mock.calls.find(([event]) => event === 'message:send')?.[1] as {
      envelopes: unknown[];
    };
    expect(payload.envelopes).toHaveLength(1);
    await waitFor(() => {
      expect(
        mockAuthedFetch.mock.calls.some(([url]) => (url as string).endsWith('/sender-keys')),
      ).toBe(true);
    });
  });
});

describe('buildMessageEnvelopes self fan-out', () => {
  const SELF = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9d1';
  const PEER = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9d2';

  async function enrollSelf() {
    const identity = await genKey();
    const signed = await genKey();
    registerOwnDeviceKeys({
      deviceId: SELF,
      identityPrivate: identity.privateKey,
      signedPrekeyPrivate: signed.privateKey,
    });
    return { identity, signed };
  }

  async function selfBundle(identity: CryptoKeyPair, signed: CryptoKeyPair) {
    return {
      deviceId: SELF,
      identityKey: await exportPub(identity.publicKey),
      signedPrekey: await exportPub(signed.publicKey),
      signedPrekeySignature: 'c2ln',
      oneTimePrekey: null,
    };
  }

  it('addresses an envelope to the sender device so own history stays readable', async () => {
    const self = await enrollSelf();
    const peer = await makeRemoteDevice(PEER);
    const bundles = new Map([
      [SELF, await selfBundle(self.identity, self.signed)],
      [peer.deviceId, await bundleFor(peer)],
    ]);
    routeFetch({
      devices: [deviceRecord(SELF, 'user-1'), deviceRecord(peer.deviceId, 'user-2')],
      bundles,
      sharePosts: [],
    });

    const envelopes = await buildMessageEnvelopes('send-chat-self-1', 'hi self', SELF, {
      e2eeEnabled: true,
    });

    expect(envelopes).toHaveLength(2);
    const own = envelopes.find((e) => e.recipientDeviceId === SELF);
    expect(own).toBeDefined();
    const selfSession = await createRecipientSession({
      ephemeralKeyB64: own?.ephemeralKey as string,
      ownIdentityPrivate: self.identity.privateKey,
      ownSignedPrekeyPrivate: self.signed.privateKey,
      theirDeviceId: SELF,
    });
    await expect(decryptFromDevice(own!, selfSession)).resolves.toBe('hi self');
  });

  it('still throws E2EE_NO_RECIPIENT_KEYS when only self is reachable in an E2EE chat', async () => {
    const self = await enrollSelf();
    // Unique peer id: send sessions are cached per device module-wide.
    const lonelyPeer = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9d3';
    const bundles = new Map([[SELF, await selfBundle(self.identity, self.signed)]]);
    routeFetch({
      devices: [deviceRecord(SELF, 'user-1'), deviceRecord(lonelyPeer, 'user-2')],
      bundles,
      sharePosts: [],
    });

    await expect(
      buildMessageEnvelopes('send-chat-self-2', 'hi', SELF, { e2eeEnabled: true }),
    ).rejects.toThrow('E2EE_NO_RECIPIENT_KEYS');
  });

  it('resolves self-only in legacy chats without throwing', async () => {
    const self = await enrollSelf();
    // Unique peer id: send sessions are cached per device module-wide.
    const legacyPeer = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9d4';
    const bundles = new Map([[SELF, await selfBundle(self.identity, self.signed)]]);
    routeFetch({
      devices: [deviceRecord(SELF, 'user-1'), deviceRecord(legacyPeer, 'user-2')],
      bundles,
      sharePosts: [],
    });

    const envelopes = await buildMessageEnvelopes('send-chat-self-3', 'hi', SELF);

    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]?.recipientDeviceId).toBe(SELF);
  });
});
