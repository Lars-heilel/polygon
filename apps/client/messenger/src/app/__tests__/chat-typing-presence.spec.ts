import { useChatStore, usePresenceStore } from '@org/entities-chat';

describe('chat typing ttl and presence lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.getState().reset();
  });

  afterEach(() => {
    jest.useRealTimers();
    useChatStore.getState().reset();
  });

  it('clears the typing flag automatically after the ttl', () => {
    jest.useFakeTimers();

    useChatStore.getState().setIsTyping('u1', true);
    expect(useChatStore.getState().typingUsers).toEqual({ u1: true });

    jest.advanceTimersByTime(3000);
    expect(useChatStore.getState().typingUsers).toEqual({});
  });

  it('refreshes the ttl on repeated typing events', () => {
    jest.useFakeTimers();

    useChatStore.getState().setIsTyping('u1', true);
    jest.advanceTimersByTime(2500);
    useChatStore.getState().setIsTyping('u1', true);
    jest.advanceTimersByTime(2500);

    expect(useChatStore.getState().typingUsers).toEqual({ u1: true });

    jest.advanceTimersByTime(500);
    expect(useChatStore.getState().typingUsers).toEqual({});
  });

  it('cancels the ttl timer when typing stops explicitly', () => {
    jest.useFakeTimers();

    useChatStore.getState().setIsTyping('u1', true);
    useChatStore.getState().setIsTyping('u1', false);
    expect(useChatStore.getState().typingUsers).toEqual({});

    jest.advanceTimersByTime(5000);
    expect(useChatStore.getState().typingUsers).toEqual({});
  });

  it('removes the presence entry on setOffline instead of keeping false', () => {
    usePresenceStore.getState().setOnline('u1');
    expect(usePresenceStore.getState().onlineUsers).toEqual({ u1: true });

    usePresenceStore.getState().setOffline('u1');
    expect(usePresenceStore.getState().onlineUsers).toEqual({});
    expect('u1' in usePresenceStore.getState().onlineUsers).toBe(false);
  });
});
