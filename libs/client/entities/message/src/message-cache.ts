type MessagePageLike<TMessage extends { id: string }> = {
  nextCursor: string | null;
  messages: TMessage[];
};

export function updateMessageInPages<
  TData extends { pages: MessagePageLike<TMessage>[]; pageParams: unknown[] },
  TMessage extends { id: string },
>(
  old: TData | undefined,
  message: Partial<TMessage> & { id: string },
): TData | undefined {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      messages: page.messages.map((current) =>
        current.id === message.id ? { ...current, ...message } : current,
      ),
    })),
  } as TData;
}

export function removeMessageFromPages<
  TData extends { pages: MessagePageLike<TMessage>[]; pageParams: unknown[] },
  TMessage extends { id: string },
>(
  old: TData | undefined,
  messageId: string,
): TData | undefined {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((message) => message.id !== messageId),
    })),
  } as TData;
}
