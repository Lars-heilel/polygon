import { useCallback, useEffect, useRef, useState } from 'react';

import {
  API_ROUTES,
  type Chat,
  type DeviceRecord,
  E2EE_NO_RECIPIENT_KEYS,
  type GroupMessageEnvelope,
  type MessageEnvelope,
  type PrekeyBundleRecord,
  type SenderKeyDistribution,
} from '@org/common';
import {
  type RatchetSession,
  createSenderKeyContext,
  encryptForGroup,
  encryptToDevice,
  ensureGroupRecipients,
  getActiveDeviceId,
  getCachedSendSession,
  getCurrentSenderKeyContext,
  getOrInitSession,
  wrapChainKeyForDevice,
} from '@org/crypto-e2ee';
import type { Message, MessageMediaCategory, MessagePage } from '@org/entities-message';
import { authedFetch, frontendLog, queryClient, socket } from '@org/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { debounce } from 'es-toolkit';

export interface FileAttachment {
  fileId: string;
  fileBucket: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  fileMime: string;
  fileCategory: string;
}

interface MessageAttachmentPayload {
  mediaId: string;
  fileNameSnapshot: string | null;
  fileSizeSnapshot: number | null;
  mimeSnapshot: string | null;
  category: string;
}

export function getMessageTypeFromCategory(category: string): string {
  switch (category) {
    case 'IMAGE':
      return 'IMAGE';
    case 'AUDIO':
      return 'AUDIO';
    case 'VIDEO':
      return 'VIDEO';
    case 'VOICE':
      return 'VOICE';
    case 'CIRCLE':
      return 'VIDEO';
    default:
      return 'FILE';
  }
}

function getKindFromCategory(category: string): Message['kind'] {
  switch (category) {
    case 'IMAGE':
      return 'image';
    case 'VIDEO':
      return 'video';
    case 'CIRCLE':
      return 'circle';
    case 'AUDIO':
      return 'audio';
    case 'VOICE':
      return 'voice';
    default:
      return 'file';
  }
}

function createAttachmentPayload(file: FileAttachment): MessageAttachmentPayload {
  return {
    mediaId: file.fileId,
    fileNameSnapshot: file.fileName,
    fileSizeSnapshot: file.fileSize,
    mimeSnapshot: file.fileMime,
    category: file.fileCategory,
  };
}

function createOptimisticMessage(input: {
  clientId: string;
  chatId: string;
  senderId: string;
  text: string | null;
  file?: FileAttachment | null;
}): Message {
  const now = new Date().toISOString();
  const file = input.file ?? null;

  return {
    id: `client:${input.clientId}`,
    clientId: input.clientId,
    chatId: input.chatId,
    senderId: input.senderId,
    kind: file ? getKindFromCategory(file.fileCategory) : 'text',
    type: file ? getMessageTypeFromCategory(file.fileCategory) : 'TEXT',
    text: input.text,
    hasLink: /https?:\/\/|www\./i.test(input.text ?? ''),
    createdAt: now,
    updatedAt: now,
    media: file
      ? {
          fileId: file.fileId,
          contentUrl: '',
          thumbUrl: null,
          fileName: file.fileName,
          mime: file.fileMime,
          size: file.fileSize,
          category: file.fileCategory as MessageMediaCategory,
          width: null,
          height: null,
          durationMs: null,
          waveform: null,
        }
      : null,
    linkPreview: null,
    attachments: file
      ? [
          {
            id: `client:${input.clientId}:attachment`,
            messageId: `client:${input.clientId}`,
            mediaId: file.fileId,
            fileNameSnapshot: file.fileName,
            fileSizeSnapshot: file.fileSize,
            mimeSnapshot: file.fileMime,
            category: file.fileCategory as MessageMediaCategory,
            createdAt: now,
          },
        ]
      : [],
    forwardContext: null,
    localStatus: 'sending',
    editedAt: null,
    deletedAt: null,
    deletedById: null,
  };
}

function insertOptimisticMessage(chatId: string, message: Message) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', chatId], (old) => {
    if (!old) return old;

    return {
      ...old,
      pages: old.pages.map((page, index) =>
        index === 0 ? { ...page, messages: [...page.messages, message] } : page,
      ),
    };
  });
}

export function removeOptimisticMessage(chatId: string, clientId: string) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', chatId], (old) => {
    if (!old) return old;

    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        messages: page.messages.filter((message) => message.clientId !== clientId),
      })),
    };
  });
}

export async function buildMessageEnvelopes(
  chatId: string,
  plaintext: string,
  senderDeviceId: string,
  opts: { e2eeEnabled?: boolean } = {},
): Promise<MessageEnvelope[]> {
  const devices = await fetchChatDevices(chatId);
  const recipients = devices.map((d) => d.deviceId).filter((id) => id !== senderDeviceId);
  const envelopes: MessageEnvelope[] = [];
  for (const deviceId of recipients) {
    const session = await sessionForRecipient(chatId, deviceId);
    if (!session) continue;
    try {
      envelopes.push(await encryptToDevice(plaintext, session, senderDeviceId));
    } catch {
      frontendLog('warn', 'SendMessage', 'e2ee_encrypt_failed', {
        hasDeviceId: !!deviceId,
      });
    }
  }
  // Fail closed in E2EE chats: no silent plaintext fallback downstream.
  if (opts.e2eeEnabled && envelopes.length === 0) {
    throw new Error(E2EE_NO_RECIPIENT_KEYS);
  }
  return envelopes;
}

/** Sender-key shares already distributed, per chat + chain + recipient. */
const distributedShares = new Set<string>();

export async function buildGroupEnvelopes(
  chatId: string,
  plaintext: string,
  senderDeviceId: string,
  opts: { e2eeEnabled?: boolean } = {},
): Promise<GroupMessageEnvelope[]> {
  const ctx = getCurrentSenderKeyContext(chatId) ?? (await createSenderKeyContext(chatId));
  const devices = await fetchChatDevices(chatId);
  const recipients = devices.map((d) => d.deviceId).filter((id) => id !== senderDeviceId);
  ensureGroupRecipients(recipients, opts.e2eeEnabled ?? false);
  for (const deviceId of recipients) {
    const shareKey = `${chatId}:${ctx.chainKeyId}:${deviceId}`;
    if (distributedShares.has(shareKey)) continue;
    const session = await sessionForRecipient(chatId, deviceId);
    if (!session) continue;
    try {
      const wrapped = await wrapChainKeyForDevice(ctx, session, senderDeviceId);
      const share: SenderKeyDistribution = {
        chatId,
        chainKeyId: ctx.chainKeyId,
        senderDeviceId,
        recipientDeviceId: deviceId,
        wrappedChainKey: JSON.stringify(wrapped),
      };
      await authedFetch<void>(API_ROUTES.chats.senderKeys(chatId), {
        method: 'POST',
        body: JSON.stringify(share),
      });
      distributedShares.add(shareKey);
    } catch {
      frontendLog('warn', 'SendMessage', 'e2ee_share_distribute_failed', {
        hasChatId: !!chatId,
        hasDeviceId: !!deviceId,
      });
    }
  }
  return [await encryptForGroup(plaintext, ctx)];
}

async function fetchChatDevices(chatId: string): Promise<DeviceRecord[]> {
  try {
    return await authedFetch<DeviceRecord[]>(API_ROUTES.chats.chatDevices(chatId));
  } catch {
    frontendLog('warn', 'SendMessage', 'e2ee_devices_fetch_failed', {
      hasChatId: !!chatId,
    });
    return [];
  }
}

/**
 * Established 1:1 session when one exists; otherwise consumes the
 * recipient's prekey bundle once and initializes a new session. Returns
 * null when the recipient has no reachable key material (caller skips).
 */
async function sessionForRecipient(
  chatId: string,
  deviceId: string,
): Promise<RatchetSession | null> {
  const cached = getCachedSendSession(deviceId);
  if (cached) return cached;
  let bundle: PrekeyBundleRecord | null;
  try {
    bundle = await authedFetch<PrekeyBundleRecord | null>(API_ROUTES.chats.prekeys(deviceId));
  } catch {
    frontendLog('warn', 'SendMessage', 'e2ee_prekey_fetch_failed', {
      hasDeviceId: !!deviceId,
    });
    return null;
  }
  if (!bundle) {
    frontendLog('warn', 'SendMessage', 'e2ee_no_bundle_for_device', {
      hasChatId: !!chatId,
      hasDeviceId: !!deviceId,
    });
    return null;
  }
  try {
    return await getOrInitSession(bundle);
  } catch {
    frontendLog('warn', 'SendMessage', 'e2ee_session_init_failed', {
      hasDeviceId: !!deviceId,
    });
    return null;
  }
}

export function useSendMessage(chatId: string | null, senderId: string | null = null) {
  const [messageText, setMessageText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const isTypingRef = useRef(false);
  const pendingFileRef = useRef<FileAttachment | null>(null);

  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  const stopTyping = useCallback(() => {
    if (!isTypingRef.current || !chatIdRef.current) return;
    isTypingRef.current = false;
    socket.emit('typing:stop', { chatId: chatIdRef.current });
  }, []);

  const debouncedStopTyping = useRef(debounce(() => stopTyping(), 2000)).current;

  useEffect(() => {
    return () => {
      stopTyping();
      debouncedStopTyping.cancel();
    };
  }, [stopTyping, debouncedStopTyping]);

  const handleChange = useCallback(
    (value: string | ((prev: string) => string)) => {
      setMessageText((prev) => {
        const resolved = typeof value === 'function' ? value(prev) : value;

        if (!chatIdRef.current) return resolved;

        if (!isTypingRef.current && resolved.trim()) {
          isTypingRef.current = true;
          socket.emit('typing:start', { chatId: chatIdRef.current });
        }

        debouncedStopTyping();
        return resolved;
      });
    },
    [debouncedStopTyping],
  );

  const setFileAttachment = useCallback((file: FileAttachment | null) => {
    pendingFileRef.current = file;
  }, []);

  const clearSendError = useCallback(() => setSendError(null), []);

  const handleSend = useCallback(async () => {
    const chatId = chatIdRef.current;
    if (!chatId || !senderId) return;

    const file = pendingFileRef.current;

    if (file) {
      const clientId = crypto.randomUUID();
      const attachment = createAttachmentPayload(file);
      const optimistic = createOptimisticMessage({
        clientId,
        chatId,
        senderId,
        text: null,
        file,
      });

      pendingFileRef.current = null;
      setMessageText('');
      await queryClient.cancelQueries({ queryKey: ['messages', chatId] });
      const snapshot = queryClient.getQueryData<InfiniteData<MessagePage>>(['messages', chatId]);
      insertOptimisticMessage(chatId, optimistic);
      frontendLog('debug', 'SendMessage', 'message_send_requested', {
        hasChatId: !!chatId,
        hasClientId: !!clientId,
        hasFile: true,
        hasText: false,
        type: getMessageTypeFromCategory(file.fileCategory),
      });
      try {
        socket.emit('message:send', {
          chatId,
          clientId,
          type: getMessageTypeFromCategory(file.fileCategory),
          attachments: [attachment],
        });
      } catch {
        if (snapshot) queryClient.setQueryData(['messages', chatId], snapshot);
        frontendLog('warn', 'SendMessage', 'message_send_failed', {
          hasChatId: !!chatId,
          hasClientId: !!clientId,
        });
        throw new Error('Socket send failed');
      }
      stopTyping();
      return;
    }

    const trimmed = messageText.trim();
    if (!trimmed) return;
    const clientId = crypto.randomUUID();
    const optimistic = createOptimisticMessage({
      clientId,
      chatId,
      senderId,
      text: trimmed,
    });

    setMessageText('');
    setSendError(null);
    await queryClient.cancelQueries({ queryKey: ['messages', chatId] });
    const snapshot = queryClient.getQueryData<InfiniteData<MessagePage>>(['messages', chatId]);
    insertOptimisticMessage(chatId, optimistic);
    frontendLog('debug', 'SendMessage', 'message_send_requested', {
      hasChatId: !!chatId,
      hasClientId: !!clientId,
      hasFile: false,
      hasText: true,
      type: 'TEXT',
    });
    try {
      const active = getActiveDeviceId();
      if (!active.enrolled) {
        frontendLog('warn', 'SendMessage', 'e2ee_device_id_fallback', {
          hasChatId: !!chatId,
        });
      }
      const chat = queryClient.getQueryData<Chat[]>(['chats'])?.find((c) => c.id === chatId);
      const e2eeEnabled = chat?.e2eeEnabled ?? false;
      const isGroup = chat ? chat.type !== 'DIRECT' : false;
      if (isGroup && e2eeEnabled) {
        const groupEnvelopes = await buildGroupEnvelopes(chatId, trimmed, active.deviceId, {
          e2eeEnabled,
        });
        frontendLog('debug', 'SendMessage', 'message_send_encrypted_group', {
          hasChatId: !!chatId,
          hasClientId: !!clientId,
          envelopeCount: groupEnvelopes.length,
        });
        socket.emit('message:send', { chatId, clientId, envelopes: groupEnvelopes });
      } else {
        const envelopes = await buildMessageEnvelopes(chatId, trimmed, active.deviceId, {
          e2eeEnabled,
        });
        if (envelopes.length > 0) {
          frontendLog('debug', 'SendMessage', 'message_send_encrypted', {
            hasChatId: !!chatId,
            hasClientId: !!clientId,
            envelopeCount: envelopes.length,
          });
          socket.emit('message:send', { chatId, clientId, envelopes });
        } else if (e2eeEnabled) {
          throw new Error(E2EE_NO_RECIPIENT_KEYS);
        } else {
          frontendLog('warn', 'SendMessage', 'message_send_plaintext_fallback', {
            hasChatId: !!chatId,
            hasClientId: !!clientId,
            envelopeCount: 0,
          });
          socket.emit('message:send', { chatId, text: trimmed, clientId });
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === E2EE_NO_RECIPIENT_KEYS) {
        if (snapshot) queryClient.setQueryData(['messages', chatId], snapshot);
        setSendError(E2EE_NO_RECIPIENT_KEYS);
        frontendLog('warn', 'SendMessage', 'message_send_no_recipient_keys', {
          hasChatId: !!chatId,
          hasClientId: !!clientId,
        });
        stopTyping();
        return;
      }
      if (snapshot) queryClient.setQueryData(['messages', chatId], snapshot);
      frontendLog('warn', 'SendMessage', 'message_send_failed', {
        hasChatId: !!chatId,
        hasClientId: !!clientId,
      });
      throw new Error('Socket send failed');
    }
    stopTyping();
  }, [messageText, senderId, stopTyping]);

  return {
    messageText,
    setMessageText: handleChange,
    handleSend,
    setFileAttachment,
    sendError,
    clearSendError,
  };
}
