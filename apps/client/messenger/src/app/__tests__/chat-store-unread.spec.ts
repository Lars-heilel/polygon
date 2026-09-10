describe('chat unread state', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.resetModules();
  });

  function loadChatStore(): typeof import('@org/entities-chat').useChatStore {
    let store: typeof import('@org/entities-chat').useChatStore | undefined;
    jest.isolateModules(() => {
      store = jest.requireActual<typeof import('@org/entities-chat')>('@org/entities-chat').useChatStore;
    });

    if (!store) {
      throw new Error('Chat store was not loaded');
    }

    return store;
  }

  it('keeps transient unread counters in memory until the chat is marked read', () => {
    const store = loadChatStore();
    store.getState().incrementUnread('chat-1');

    expect(store.getState().unreadByChatId).toEqual({ 'chat-1': 1 });

    store.getState().markChatRead('chat-1');

    expect(store.getState().unreadByChatId).toEqual({});
  });

  it('does not persist unread counters across module reload (server unreadCount is the source)', () => {
    localStorage.setItem('chat-unread-state', JSON.stringify({ state: { unreadByChatId: { 'chat-1': 1 } } }));
    const store = loadChatStore();

    expect(store.getState().unreadByChatId).toEqual({});
    expect(localStorage.getItem('chat-unread-state')).toBeNull();
  });

  it('does not persist active chat state across module reload', () => {
    const firstStore = loadChatStore();
    firstStore.getState().setActiveChat('chat-1');
    firstStore.getState().incrementUnread('chat-2');

    jest.resetModules();
    const secondStore = loadChatStore();

    expect(secondStore.getState().activeChatId).toBeNull();
    expect(secondStore.getState().unreadByChatId).toEqual({});
  });
});
