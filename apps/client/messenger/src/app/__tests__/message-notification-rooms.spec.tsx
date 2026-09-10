import { renderHook } from '@testing-library/react';

import { socket } from '@org/shared';

import { useMessageNotification } from '../../../../../../libs/client/features/notifications/src/use-message-notification';

const mockSocketEmit = jest.fn();
const mockLoggerDebug = jest.fn();
const mockLogger = {
  debug: mockLoggerDebug,
};

let mockActiveChatId = 'chat-1';
let mockChats: Array<{ id: string }> = [{ id: 'chat-1' }, { id: 'chat-2' }];

jest.mock('@org/shared', () => ({
  queryClient: {
    getQueryData: jest.fn(),
    setQueryData: jest.fn(),
  },
  socket: {
    emit: (...args: unknown[]) => mockSocketEmit(...args),
    on: jest.fn(),
    off: jest.fn(),
  },
  toast: jest.fn(),
  useLogger: () => mockLogger,
}));

jest.mock('@org/entities-chat', () => {
  const useChatStore = (selector: (state: unknown) => unknown) =>
    selector({
      activeChatId: mockActiveChatId,
      lastReceivedMessage: null,
      incrementUnread: jest.fn(),
    });

  useChatStore.getState = () => ({
    activeChatId: mockActiveChatId,
    setLastReceivedMessage: jest.fn(),
  });

  return {
    getMessagePreview: jest.fn(() => 'Preview'),
    selectLastReceivedMessage: (state: { lastReceivedMessage: unknown }) => state.lastReceivedMessage,
    useChatStore,
    useGetChatsQuery: () => ({ data: mockChats }),
  };
});

describe('useMessageNotification room joins', () => {
  beforeEach(() => {
    mockActiveChatId = 'chat-1';
    mockChats = [{ id: 'chat-1' }, { id: 'chat-2' }];
    mockSocketEmit.mockClear();
    mockLoggerDebug.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not rejoin all notification rooms when only the active chat changes', () => {
    const { rerender } = renderHook(() => useMessageNotification());

    jest.advanceTimersByTime(500);

    expect(mockSocketEmit).toHaveBeenCalledTimes(2);
    expect(mockSocketEmit).toHaveBeenNthCalledWith(1, 'chat:join', { chatId: 'chat-1' });
    expect(mockSocketEmit).toHaveBeenNthCalledWith(2, 'chat:join', { chatId: 'chat-2' });

    mockActiveChatId = 'chat-2';
    rerender();
    jest.advanceTimersByTime(500);

    expect(mockSocketEmit).toHaveBeenCalledTimes(2);
  });

  it('joins only new chats and leaves removed ones (diff)', () => {
    const { rerender } = renderHook(() => useMessageNotification());
    jest.advanceTimersByTime(500);
    expect(mockSocketEmit).toHaveBeenCalledTimes(2);

    mockChats = [{ id: 'chat-2' }, { id: 'chat-3' }];
    rerender();
    jest.advanceTimersByTime(500);

    expect(mockSocketEmit).toHaveBeenCalledWith('chat:join', { chatId: 'chat-3' });
    expect(mockSocketEmit).toHaveBeenCalledWith('chat:leave', { chatId: 'chat-1' });
    expect(mockSocketEmit).toHaveBeenCalledTimes(4);
    expect(
      mockSocketEmit.mock.calls.filter(
        ([event, payload]) => event === 'chat:join' && payload.chatId === 'chat-2',
      ),
    ).toHaveLength(1);
  });

  it('does not attach its own message:new listener', () => {
    renderHook(() => useMessageNotification());

    expect(socket.on).not.toHaveBeenCalledWith('message:new', expect.any(Function));
  });
});
