import { normalizeMessage, type RawMessage } from '@org/entities-message';

type MessageLike = {
  id: string;
  clientId?: string | null;
  chatId: string;
  createdAt: string;
  senderId?: string | null;
  type?: string | null;
  text?: string | null;
  media?: { fileId: string } | null;
  localStatus?: 'sending' | 'sent' | 'error';
};

type MessagePageLike = {
  messages: MessageLike[];
};

type ChatLike = {
  id: string;
  updatedAt: string;
  lastMessage: { createdAt: string } | null;
};

type ChatWithUnreadLike = ChatLike & {
  unreadCount?: number;
};

type MessagePatchLike = Partial<MessageLike> & Pick<MessageLike, 'id'>;

export function upsertMessageIntoPages<
  TData extends { pages: MessagePageLike[] },
>(
  old: TData | undefined,
  msg: MessageLike,
): TData | undefined {
  if (!old) return old;

  const normalizedMsg = normalizeSocketMessage(msg);
  let replaced = false;
  const pages = old.pages.map((page) => ({
    ...page,
    messages: page.messages.map((message) => {
      const sameServerId = message.id === normalizedMsg.id;
      const sameClientId = Boolean(message.clientId) && message.clientId === normalizedMsg.clientId;
      const samePendingMessage = isMatchingPendingEcho(message, normalizedMsg);

      if (!sameServerId && !sameClientId && !samePendingMessage) return message;

      replaced = true;
      return {
        ...message,
        ...normalizedMsg,
        clientId: normalizedMsg.clientId ?? message.clientId ?? null,
        localStatus: 'sent' as const,
      };
    }),
  }));

  if (replaced) {
    return { ...old, pages } as TData;
  }

  if (pages.some((page) => page.messages.some((message) => message.id === normalizedMsg.id))) {
    return old;
  }

  return appendMessageToPages({ ...old, pages } as TData, normalizedMsg);
}

function isMatchingPendingEcho(message: MessageLike, msg: MessageLike): boolean {
  if (message.localStatus !== 'sending') return false;
  if (msg.localStatus === 'sending') return false;
  if (message.chatId !== msg.chatId) return false;
  if (message.senderId && msg.senderId && message.senderId !== msg.senderId) return false;
  if (message.type && msg.type && message.type !== msg.type) return false;

  if (message.media?.fileId || msg.media?.fileId) {
    return Boolean(message.media?.fileId) && message.media?.fileId === msg.media?.fileId;
  }

  return Boolean(message.text) && message.text === msg.text;
}

export function appendMessageToPages<
  TData extends { pages: MessagePageLike[] },
>(
  old: TData | undefined,
  msg: MessageLike,
): TData | undefined {
  if (!old) return old;
  const normalizedMsg = normalizeSocketMessage(msg);
  if (old.pages.some((page) => page.messages.some((message) => message.id === normalizedMsg.id))) return old;

  return {
    ...old,
    pages: old.pages.map((page, index) =>
      index === 0 ? { ...page, messages: [...page.messages, normalizedMsg] } : page,
    ),
  } as TData;
}

export function markMessageSendError<
  TData extends { pages: MessagePageLike[] },
>(
  old: TData | undefined,
  clientId: string,
): TData | undefined {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.clientId === clientId
          ? { ...message, localStatus: 'error' as const }
          : message,
      ),
    })),
  } as TData;
}

export function updateMessageInPages<
  TData extends { pages: MessagePageLike[] },
  TMessage extends MessagePatchLike,
>(
  old: TData | undefined,
  msg: TMessage,
): TData | undefined {
  if (!old) return old;
  const normalizedMsg = normalizeSocketMessage(msg);

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.id === normalizedMsg.id ? { ...message, ...normalizedMsg } : message,
      ),
    })),
  } as TData;
}

export function removeMessageFromPages<
  TData extends { pages: MessagePageLike[] },
>(old: TData | undefined, messageId: string): TData | undefined {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((message) => message.id !== messageId),
    })),
  } as TData;
}

export function updateChatListLastMessage<TChat extends ChatLike, TMessage extends MessageLike>(
  chats: TChat[] | undefined,
  msg: TMessage,
): TChat[] {
  const normalizedMsg = normalizeSocketMessage(msg);
  const next = (chats ?? []).map((chat) =>
    chat.id === normalizedMsg.chatId ? { ...chat, lastMessage: normalizedMsg } as TChat : chat,
  );

  next.sort((left, right) => {
    const leftTime = left.lastMessage?.createdAt ?? left.updatedAt;
    const rightTime = right.lastMessage?.createdAt ?? right.updatedAt;
    return new Date(rightTime).getTime() - new Date(leftTime).getTime();
  });

  return next;
}

export function updateChatListUnreadCount<TChat extends ChatWithUnreadLike>(
  chats: TChat[] | undefined,
  chatId: string,
  delta: number,
): TChat[] {
  return (chats ?? []).map((chat) =>
    chat.id === chatId ? { ...chat, unreadCount: (chat.unreadCount ?? 0) + delta } : chat,
  );
}

function normalizeSocketMessage<TMessage extends MessagePatchLike>(msg: TMessage): TMessage {
  if (!isRawSocketMessage(msg)) return msg;
  return normalizeMessage(msg) as unknown as TMessage;
}

function isRawSocketMessage(msg: Partial<MessageLike> & Pick<MessageLike, 'id'>): msg is RawMessage & MessageLike {
  if (
    typeof msg.chatId !== 'string'
    || typeof msg.senderId !== 'string'
    || typeof msg.type !== 'string'
    || !('updatedAt' in msg)
    || !('editedAt' in msg)
    || !('deletedAt' in msg)
    || !('deletedById' in msg)
  ) {
    return false;
  }

  const forwardContext = (msg as { forwardContext?: unknown }).forwardContext;
  if (
    forwardContext
    && typeof forwardContext === 'object'
    && 'originalAuthorNameSnapshot' in forwardContext
  ) {
    return true;
  }

  return Array.isArray((msg as { attachments?: unknown }).attachments) && !('kind' in msg);
}
