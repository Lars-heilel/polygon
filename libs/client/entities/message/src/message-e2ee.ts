import { API_ROUTES, type PrekeyBundleRecord } from '@org/common';
import {
  type RatchetSession,
  decryptFromDevice,
  getOrCreateDeviceId,
  getOrInitSession,
} from '@org/crypto-e2ee';
import { authedFetch, frontendLog } from '@org/shared';

import { normalizeMessage } from './message-normalizer.js';
import type { Message, RawMessage } from './message.types.js';

export type SessionResolver = (senderDeviceId: string) => Promise<RatchetSession | null>;

export async function defaultSessionResolver(
  senderDeviceId: string,
): Promise<RatchetSession | null> {
  const bundle = await authedFetch<PrekeyBundleRecord | null>(
    API_ROUTES.chats.prekeys(senderDeviceId),
  );
  if (!bundle) return null;
  return getOrInitSession(bundle);
}

export async function decryptIncomingMessage(
  raw: RawMessage,
  deviceId: string = getOrCreateDeviceId(),
  resolveSession: SessionResolver = defaultSessionResolver,
): Promise<Message> {
  const base = normalizeMessage(raw);
  const envelope = raw.envelopes?.find((e) => e.recipientDeviceId === deviceId) ?? null;
  if (!envelope) return base;
  try {
    const session = await resolveSession(envelope.senderDeviceId);
    if (!session) throw new Error('E2EE_NO_SESSION');
    const text = await decryptFromDevice(envelope, session);
    return { ...base, text, hasLink: /https?:\/\/|www\./i.test(text) };
  } catch {
    frontendLog('warn', 'MessageE2ee', 'e2ee_decrypt_failed', {
      hasChatId: !!raw.chatId,
      hasMessageId: !!raw.id,
      hasSenderDeviceId: !!envelope.senderDeviceId,
    });
    return { ...base, text: null, undecryptable: true };
  }
}
