import type { GroupMessageEnvelope, MessageEnvelope } from '@org/common';
import {
  E2EE_DECRYPT_FAILED,
  type RatchetSession,
  consumeOwnOneTimePrivate,
  decryptFromDevice,
  decryptFromGroup,
  getActiveDeviceId,
  getOrInitReceiveSession,
  getOwnDeviceKeys,
  getOwnOneTimePrivate,
  listOwnOneTimePublicKeys,
} from '@org/crypto-e2ee';
import { frontendLog } from '@org/shared';

import { normalizeMessage } from './message-normalizer.js';
import type { Message, RawMessage } from './message.types.js';

export type SessionResolver = (envelope: MessageEnvelope) => Promise<RatchetSession | null>;

// Re-exported so socket layers can classify failures without importing crypto.
export { E2EE_DECRYPT_FAILED };

export async function defaultSessionResolver(
  envelope: MessageEnvelope,
): Promise<RatchetSession | null> {
  const own = getOwnDeviceKeys();
  if (!own) throw new Error('E2EE_NO_OWN_KEYS');
  // The sender mixes dh3 from exactly one consumed one-time prekey, but the
  // envelope does not say which. Trial-derive per retained private half and
  // keep the session whose chain actually decrypts this envelope; the used
  // private is consumed (deleted) once. Signed-only fallback comes last.
  // Each candidate is cache-tagged by its one-time public id so trials never
  // poison each other's cached receive session.
  const pubs = listOwnOneTimePublicKeys();
  for (const pub of pubs) {
    const oneTimePrivate = getOwnOneTimePrivate(pub);
    try {
      const session = await getOrInitReceiveSession(
        envelope,
        {
          identityPrivate: own.identityPrivate,
          signedPrekeyPrivate: own.signedPrekeyPrivate,
          oneTimePrivate,
        },
        pub,
      );
      // Proof of correctness: the chain must decrypt this exact envelope.
      await decryptFromDevice(envelope, session);
      consumeOwnOneTimePrivate(pub);
      return session;
    } catch {
      // Wrong half (or undecryptable) — try the next candidate.
    }
  }
  if (own.oneTimePrivate) {
    return getOrInitReceiveSession(
      envelope,
      {
        identityPrivate: own.identityPrivate,
        signedPrekeyPrivate: own.signedPrekeyPrivate,
        oneTimePrivate: own.oneTimePrivate,
      },
      'legacy-single',
    );
  }
  return getOrInitReceiveSession(
    envelope,
    {
      identityPrivate: own.identityPrivate,
      signedPrekeyPrivate: own.signedPrekeyPrivate,
    },
    'signed-only',
  );
}

/**
 * Retry action for the «Не удалось расшифровать» placeholder: re-runs
 * key-fetch (consume bundle / re-fetch sender chain via the default resolver)
 * + decrypt. Plaintext messages (no envelopes) are unaffected.
 */
export async function retryDecryptMessage(raw: RawMessage): Promise<Message> {
  return decryptIncomingMessage(raw);
}

export async function decryptIncomingMessage(
  raw: RawMessage,
  deviceId?: string,
  resolveSession: SessionResolver = defaultSessionResolver,
): Promise<Message> {
  const base = normalizeMessage(raw);
  const activeDeviceId = deviceId ?? resolveActiveDeviceId(raw.chatId);
  const envelope =
    raw.envelopes?.find(
      (e): e is MessageEnvelope =>
        'recipientDeviceId' in e && e.recipientDeviceId === activeDeviceId,
    ) ?? null;
  if (!envelope) return decryptGroupEnvelope(raw, base);
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
      return { ...base, text: null, undecryptable: true, raw };
    }
    throw err;
  }
}

/** Enrolled device id is the primary path; random fallback logs a warn. */
function resolveActiveDeviceId(chatId: string): string {
  const active = getActiveDeviceId();
  if (!active.enrolled) {
    frontendLog('warn', 'MessageE2ee', 'e2ee_device_id_fallback', { hasChatId: !!chatId });
  }
  return active.deviceId;
}

/**
 * Group envelopes carry no per-device recipient — decrypt via the sender
 * chain lookup (memory, hydrated from IndexedDB after reload). Unknown
 * chains render the undecryptable placeholder with the raw payload attached
 * so the retry action can re-run key-fetch + decrypt.
 */
async function decryptGroupEnvelope(raw: RawMessage, base: Message): Promise<Message> {
  const envelope = raw.envelopes?.find((e): e is GroupMessageEnvelope => 'chainKeyId' in e) ?? null;
  if (!envelope) return base;
  try {
    const text = await decryptFromGroup(envelope);
    return { ...base, text, hasLink: /https?:\/\/|www\./i.test(text) };
  } catch (err) {
    if (err instanceof Error && err.message === E2EE_DECRYPT_FAILED) {
      frontendLog('warn', 'MessageE2ee', 'e2ee_group_decrypt_failed', {
        hasChatId: !!raw.chatId,
        hasMessageId: !!raw.id,
        hasSenderDeviceId: !!envelope.senderDeviceId,
      });
      return { ...base, text: null, undecryptable: true, raw };
    }
    throw err;
  }
}
