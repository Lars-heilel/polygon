type MessageLike = {
  id: string;
  clientId?: string | null;
  chatId: string;
  createdAt: string;
  localStatus?: 'sending' | 'sent' | 'error';
};

type MessagePageLike<TMessage extends MessageLike> = {
  messages: TMessage[];
};

type ChatLike<TMessage extends MessageLike> = {
  id: string;
  updatedAt: string;
  lastMessage: TMessage | null;
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

      if (!sameServerId && !sameClientId) return message;

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

export function updateChatListLastMessage<TChat extends ChatLike<TMessage>, TMessage extends MessageLike>(
  chats: TChat[] | undefined,
  msg: TMessage,
): TChat[] {
  const next = (chats ?? []).map((chat) =>
    chat.id === msg.chatId ? { ...chat, lastMessage: msg } : chat,
  );

  next.sort((left, right) => {
    const leftTime = left.lastMessage?.createdAt ?? left.updatedAt;
    const rightTime = right.lastMessage?.createdAt ?? right.updatedAt;
    return new Date(rightTime).getTime() - new Date(leftTime).getTime();
  });

  return next;
}
