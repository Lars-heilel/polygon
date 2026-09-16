type MessagePageLike<TMessage extends { id: string }> = {
  nextCursor: string | null;
  messages: TMessage[];
};

function hasMessageInPages<
  TData extends { pages: MessagePageLike<TMessage>[]; pageParams: unknown[] },
  TMessage extends { id: string },
>(data: TData, messageId: string): boolean {
  return data.pages.some((page) => page.messages.some((m) => m.id === messageId));
}

export function updateMessageInPages<
  TData extends { pages: MessagePageLike<TMessage>[]; pageParams: unknown[] },
  TMessage extends { id: string },
>(old: TData | undefined, message: Partial<TMessage> & { id: string }): TData | undefined {
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

export function appendMessageToPages<
  TData extends { pages: MessagePageLike<TMessage>[]; pageParams: unknown[] },
  TMessage extends { id: string },
>(old: TData | undefined, message: TMessage): TData | undefined {
  if (!old) {
    return { pages: [{ messages: [message], nextCursor: null }], pageParams: [undefined] } as TData;
  }
  if (old.pages.some((page) => page.messages.some((m) => m.id === message.id))) return old;
  const [first, ...rest] = old.pages;
  if (!first) return old;
  return {
    ...old,
    pages: [{ ...first, messages: [...first.messages, message] }, ...rest],
  } as TData;
}

export function mergeDeltaIntoPages<
  TData extends { pages: MessagePageLike<TMessage>[]; pageParams: unknown[] },
  TMessage extends { id: string },
>(old: TData | undefined, messages: TMessage[], deletedIds: string[]): TData | undefined {
  let next = old;
  const deleted = new Set(deletedIds);
  for (const message of messages) {
    // Upsert: delta edits must update the cached entry instead of being
    // dropped by the duplicate-id guard in `appendMessageToPages`.
    next =
      next && hasMessageInPages(next, message.id)
        ? updateMessageInPages(next, message)
        : appendMessageToPages(next, message);
  }
  if (!next) return next;
  if (deleted.size === 0) return next;
  return {
    ...next,
    pages: next.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((m) => !deleted.has(m.id)),
    })),
  } as TData;
}
export function removeMessageFromPages<
  TData extends { pages: MessagePageLike<TMessage>[]; pageParams: unknown[] },
  TMessage extends { id: string },
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
