import type { MessageEnvelope } from '@org/common';
import {
  E2EE_DECRYPT_FAILED,
  type RatchetSession,
  decryptFromDevice,
  getOrCreateDeviceId,
  getOrInitReceiveSession,
  getOwnDeviceKeys,
} from '@org/crypto-e2ee';
import { frontendLog } from '@org/shared';

import { normalizeMessage } from './message-normalizer.js';
import type { Message, RawMessage } from './message.types.js';

export type SessionResolver = (envelope: MessageEnvelope) => Promise<RatchetSession | null>;

export async function defaultSessionResolver(
  envelope: MessageEnvelope,
): Promise<RatchetSession | null> {
  const own = getOwnDeviceKeys();
  if (!own) throw new Error('E2EE_NO_OWN_KEYS');
  return getOrInitReceiveSession(envelope, {
    identityPrivate: own.identityPrivate,
    signedPrekeyPrivate: own.signedPrekeyPrivate,
    oneTimePrivate: own.oneTimePrivate,
  });
}

export async function decryptIncomingMessage(
  raw: RawMessage,
  deviceId: string = getOrCreateDeviceId(),
  resolveSession: SessionResolver = defaultSessionResolver,
): Promise<Message> {
  const base = normalizeMessage(raw);
  const envelope = raw.envelopes?.find((e) => e.recipientDeviceId === deviceId) ?? null;
  if (!envelope) return base;
  const session = await resolveSession(envelope);
  if (!session) throw new Error('E2EE_NO_SESSION');
  try {
    const text = await decryptFromDevice(envelope, session);
    return { ...base, text, hasLink: /https?:\/\/|www\./i.test(text) };
  } catch (err) {
    if (err instanceof Error && err.message === E2EE_DECRYPT_FAILED) {
      frontendLog('warn', 'MessageE2ee', 'e2ee_decrypt_failed', {
        hasChatId: !!raw.chatId,
        hasMessageId: !!raw.id,
        hasSenderDeviceId: !!envelope.senderDeviceId,
      });
      return { ...base, text: null, undecryptable: true };
    }
    throw err;
  }
}
