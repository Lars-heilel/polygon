import {
  E2EE_NO_RECIPIENT_KEYS,
  type GroupMessageEnvelope,
  type MessageEnvelope,
} from '@org/common';

import { bytesToBase64, getOrCreateDeviceId, getOwnDeviceKeys } from './device-keys.js';
import {
  E2EE_DECRYPT_FAILED,
  type RatchetSession,
  decryptFromDevice,
  encryptToDevice,
} from './ratchet-session.js';
import { loadPersistedChain, persistChain, persistCurrentChain } from './sender-chain-store.js';

export interface SenderKeyContext {
  chatId: string;
  chainKeyId: string;
  chainKey: CryptoKey;
  counter: number;
}

export { E2EE_DECRYPT_FAILED, E2EE_NO_RECIPIENT_KEYS };

/** Own sending chain per chat; every known chain by id (own + received + rotated). */
const currentByChatId = new Map<string, SenderKeyContext>();
const chainsByChainKeyId = new Map<string, CryptoKey>();
/**
 * Raw chain bytes, kept only for chains this device created: WebCrypto
 * forbids extractable HKDF keys, so wrapping (distribution) reads the raw
 * sidecar while encrypt/decrypt use the non-extractable `chainKey`.
 */
const rawByChainKeyId = new Map<string, Uint8Array>();

let fallbackSenderDeviceId: string | null = null;

function resolveSenderDeviceId(): string {
  const own = getOwnDeviceKeys()?.deviceId;
  if (own) return own;
  if (!fallbackSenderDeviceId) fallbackSenderDeviceId = getOrCreateDeviceId();
  return fallbackSenderDeviceId;
}

const fromB64 = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function counterSalt(counter: number): Uint8Array<ArrayBuffer> {
  const salt: Uint8Array<ArrayBuffer> = new Uint8Array(4);
  new DataView(salt.buffer).setUint32(0, counter, false);
  return salt;
}

async function generateChainKey(): Promise<{ key: CryptoKey; raw: Uint8Array }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HKDF' }, false, ['deriveKey']);
  return { key, raw };
}

function trackOwnedChain(
  chatId: string,
  chainKeyId: string,
  key: CryptoKey,
  raw: Uint8Array,
): void {
  chainsByChainKeyId.set(chainKeyId, key);
  rawByChainKeyId.set(chainKeyId, raw);
  // Mirror to IndexedDB so the chain survives reload; memory stays the
  // synchronous source of truth (fallback in tests without IndexedDB).
  void persistChain({ chainKeyId, chatId, chainKey: key }).catch(() => undefined);
  void persistCurrentChain(chatId, chainKeyId).catch(() => undefined);
}

async function deriveGroupMessageKey(chainKey: CryptoKey, counter: number): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: counterSalt(counter),
      info: new TextEncoder().encode('group-msg'),
    },
    chainKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function createSenderKeyContext(chatId: string): Promise<SenderKeyContext> {
  const { key, raw } = await generateChainKey();
  const ctx: SenderKeyContext = {
    chatId,
    chainKeyId: crypto.randomUUID(),
    chainKey: key,
    counter: 0,
  };
  currentByChatId.set(chatId, ctx);
  trackOwnedChain(chatId, ctx.chainKeyId, key, raw);
  return ctx;
}

/** Current sending chain for a chat, if this device has created or rotated one. */
export function getCurrentSenderKeyContext(chatId: string): SenderKeyContext | null {
  return currentByChatId.get(chatId) ?? null;
}

export async function encryptForGroup(
  plaintext: string,
  ctx: SenderKeyContext,
): Promise<GroupMessageEnvelope> {
  const messageKey = await deriveGroupMessageKey(ctx.chainKey, ctx.counter);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    messageKey,
    new TextEncoder().encode(plaintext),
  );
  const envelope: GroupMessageEnvelope = {
    senderDeviceId: resolveSenderDeviceId(),
    chainKeyId: ctx.chainKeyId,
    counter: ctx.counter,
    ciphertext: bytesToBase64(new Uint8Array(ct)),
    iv: bytesToBase64(iv),
  };
  ctx.counter += 1;
  chainsByChainKeyId.set(ctx.chainKeyId, ctx.chainKey);
  return envelope;
}

export async function decryptWithChainKey(
  envelope: GroupMessageEnvelope,
  chainKey: CryptoKey,
): Promise<string> {
  const messageKey = await deriveGroupMessageKey(chainKey, envelope.counter);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(envelope.iv) },
      messageKey,
      fromB64(envelope.ciphertext),
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error(E2EE_DECRYPT_FAILED);
  }
}

export async function decryptFromGroup(envelope: GroupMessageEnvelope): Promise<string> {
  const cached = chainsByChainKeyId.get(envelope.chainKeyId);
  if (cached) return decryptWithChainKey(envelope, cached);
  // Survives reload: received chains are mirrored to IndexedDB, so a cold
  // start hydrates them here without any re-fetch.
  const persisted = await loadPersistedChain(envelope.chainKeyId);
  if (persisted) {
    chainsByChainKeyId.set(envelope.chainKeyId, persisted.chainKey);
    return decryptWithChainKey(envelope, persisted.chainKey);
  }
  throw new Error(E2EE_DECRYPT_FAILED);
}

/**
 * Rotate the sending chain for a chat (call on membership change).
 * The old chain stays registered so history still decrypts; removed members
 * never receive shares of the new chain, so new messages stay closed to them.
 */
export async function rotateSenderKey(chatId: string): Promise<SenderKeyContext> {
  const { key, raw } = await generateChainKey();
  const ctx: SenderKeyContext = {
    chatId,
    chainKeyId: crypto.randomUUID(),
    chainKey: key,
    counter: 0,
  };
  currentByChatId.set(chatId, ctx);
  trackOwnedChain(chatId, ctx.chainKeyId, key, raw);
  return ctx;
}

interface WrappedChainKeyPayload {
  chainKeyId: string;
  chainKey: string;
}

/**
 * Wrap a group chain key for one recipient device through its 1:1 session.
 * The sender calls this per recipient device, then stores each share via
 * the sender-key distribution endpoint.
 */
export async function wrapChainKeyForDevice(
  ctx: SenderKeyContext,
  session: RatchetSession,
  senderDeviceId: string,
): Promise<MessageEnvelope> {
  const raw = rawByChainKeyId.get(ctx.chainKeyId);
  if (!raw) throw new Error('E2EE_CHAIN_NOT_OWNED');
  const payload: WrappedChainKeyPayload = {
    chainKeyId: ctx.chainKeyId,
    chainKey: bytesToBase64(raw),
  };
  return encryptToDevice(JSON.stringify(payload), session, senderDeviceId);
}

/** Unwrap a distributed chain key and register it for `decryptFromGroup`. */
export async function unwrapChainKey(
  envelope: MessageEnvelope,
  session: RatchetSession,
): Promise<{ chainKeyId: string; chainKey: CryptoKey }> {
  let payload: WrappedChainKeyPayload;
  try {
    const raw = JSON.parse(await decryptFromDevice(envelope, session)) as unknown;
    if (
      typeof raw !== 'object' ||
      raw === null ||
      typeof (raw as WrappedChainKeyPayload).chainKeyId !== 'string' ||
      typeof (raw as WrappedChainKeyPayload).chainKey !== 'string'
    ) {
      throw new Error('bad payload');
    }
    payload = raw as WrappedChainKeyPayload;
  } catch (error) {
    if (error instanceof Error && error.message === E2EE_DECRYPT_FAILED) throw error;
    throw new Error(E2EE_DECRYPT_FAILED);
  }
  const chainKey = await crypto.subtle.importKey(
    'raw',
    fromB64(payload.chainKey),
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  );
  chainsByChainKeyId.set(payload.chainKeyId, chainKey);
  // Received chains must survive reload: mirror to IndexedDB (no re-fetch
  // dependency on cold start). Chat id is unknown at unwrap time.
  void persistChain({ chainKeyId: payload.chainKeyId, chatId: null, chainKey }).catch(
    () => undefined,
  );
  return { chainKeyId: payload.chainKeyId, chainKey };
}

/**
 * Fail-closed gating for group sends: an E2EE chat with no discoverable
 * recipient devices must throw instead of falling back to plaintext.
 */
export function ensureGroupRecipients(recipientDeviceIds: string[], e2eeEnabled: boolean): void {
  if (e2eeEnabled && recipientDeviceIds.length === 0) {
    throw new Error(E2EE_NO_RECIPIENT_KEYS);
  }
}
