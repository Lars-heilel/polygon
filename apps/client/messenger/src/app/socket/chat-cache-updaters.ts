type MessageLike = {
  id: string;
  clientId?: string | null;
  chatId: string;
  createdAt: string;
  senderId?: string | null;
  type?: string | null;
  text?: string | null;
  fileId?: string | null;
  fileCategory?: string | null;
  localStatus?: 'sending' | 'sent' | 'error';
};

type MessagePageLike<TMessage extends MessageLike> = {
  messages: TMessage[];
};

type ChatLike = {
  id: string;
  updatedAt: string;
  lastMessage: unknown;
};

export function upsertMessageIntoPages<
  TData extends { pages: TPage[] },
  TPage extends MessagePageLike<TMessage>,
  TMessage extends MessageLike,
>(
  old: TData | undefined,
  msg: TMessage,
): TData | undefined {
  if (!old) return old;

  let replaced = false;
  const pages = old.pages.map((page) => ({
    ...page,
    messages: page.messages.map((message) => {
      const sameServerId = message.id === msg.id;
      const sameClientId = Boolean(message.clientId) && message.clientId === msg.clientId;
      const samePendingMessage = isMatchingPendingEcho(message, msg);

      if (!sameServerId && !sameClientId && !samePendingMessage) return message;

      replaced = true;
      return {
        ...message,
        ...msg,
        clientId: msg.clientId ?? message.clientId ?? null,
        localStatus: 'sent' as const,
      };
    }),
  }));

  if (replaced) {
    return { ...old, pages } as TData;
  }

  if (pages.some((page) => page.messages.some((message) => message.id === msg.id))) {
    return old;
  }

  return appendMessageToPages({ ...old, pages } as TData, msg);
}

function isMatchingPendingEcho<TMessage extends MessageLike>(message: TMessage, msg: TMessage): boolean {
  if (message.localStatus !== 'sending') return false;
  if (msg.localStatus === 'sending') return false;
  if (message.chatId !== msg.chatId) return false;
  if (message.senderId && msg.senderId && message.senderId !== msg.senderId) return false;
  if (message.type && msg.type && message.type !== msg.type) return false;

  if (message.fileId || msg.fileId) {
    return Boolean(message.fileId) && message.fileId === msg.fileId;
  }

  return Boolean(message.text) && message.text === msg.text;
}

export function appendMessageToPages<
  TData extends { pages: TPage[] },
  TPage extends MessagePageLike<TMessage>,
  TMessage extends MessageLike,
>(
  old: TData | undefined,
  msg: TMessage,
): TData | undefined {
  if (!old) return old;
  if (old.pages.some((page) => page.messages.some((message) => message.id === msg.id))) return old;

  return {
    ...old,
    pages: old.pages.map((page, index) =>
      index === 0 ? { ...page, messages: [...page.messages, msg] } : page,
    ),
  } as TData;
}

export function markMessageSendError<
  TData extends { pages: TPage[] },
  TPage extends MessagePageLike<TMessage>,
  TMessage extends MessageLike,
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

export function updateChatListLastMessage<TChat extends ChatLike, TMessage extends MessageLike>(
  chats: TChat[] | undefined,
  msg: TMessage,
): TChat[] {
  const next = (chats ?? []).map((chat) =>
    chat.id === msg.chatId ? { ...chat, lastMessage: msg } as TChat : chat,
  );

  next.sort((left, right) => {
    const leftTime = left.lastMessage?.createdAt ?? left.updatedAt;
    const rightTime = right.lastMessage?.createdAt ?? right.updatedAt;
    return new Date(rightTime).getTime() - new Date(leftTime).getTime();
  });

  return next;
}
