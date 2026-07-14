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

  it('keeps unread counters after store module reload until the chat is marked read', () => {
    const firstStore = loadChatStore();
    firstStore.getState().incrementUnread('chat-1');

    expect(firstStore.getState().unreadByChatId).toEqual({ 'chat-1': 1 });

    jest.resetModules();
    const secondStore = loadChatStore();

    expect(secondStore.getState().unreadByChatId).toEqual({ 'chat-1': 1 });

    secondStore.getState().markChatRead('chat-1');

    expect(secondStore.getState().unreadByChatId).toEqual({});
  });

  it('does not persist active chat state across module reload', () => {
    const firstStore = loadChatStore();
    firstStore.getState().setActiveChat('chat-1');
    firstStore.getState().incrementUnread('chat-2');

    jest.resetModules();
    const secondStore = loadChatStore();

    expect(secondStore.getState().activeChatId).toBeNull();
    expect(secondStore.getState().unreadByChatId).toEqual({ 'chat-2': 1 });
  });
});
