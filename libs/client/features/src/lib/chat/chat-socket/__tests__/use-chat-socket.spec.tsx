import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';

import { useChatSocket } from '../use-chat-socket';

const mockSocket = vi.hoisted(() => ({
  connected: false,
  connect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));

vi.mock('@org/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/shared')>();
  return { ...actual, socket: mockSocket };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useChatSocket', () => {
  beforeEach(() => {
    mockSocket.connected = false;
    mockSocket.connect.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
  });

  it('connects socket if not already connected', () => {
    mockSocket.connected = false;

    renderHook(() => useChatSocket('chat-1'), { wrapper: createWrapper() });

    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect if socket is already connected', () => {
    mockSocket.connected = true;

    renderHook(() => useChatSocket('chat-1'), { wrapper: createWrapper() });

    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it('emits chat:join with chatId on mount', () => {
    renderHook(() => useChatSocket('chat-1'), { wrapper: createWrapper() });

    expect(mockSocket.emit).toHaveBeenCalledWith('chat:join', { chatId: 'chat-1' });
  });

  it('registers message:new listener on mount', () => {
    renderHook(() => useChatSocket('chat-1'), { wrapper: createWrapper() });

    expect(mockSocket.on).toHaveBeenCalledWith('message:new', expect.any(Function));
  });

  it('emits chat:leave and removes listener on unmount', () => {
    const { unmount } = renderHook(() => useChatSocket('chat-1'), { wrapper: createWrapper() });

    unmount();

    expect(mockSocket.emit).toHaveBeenCalledWith('chat:leave', { chatId: 'chat-1' });
    expect(mockSocket.off).toHaveBeenCalledWith('message:new', expect.any(Function));
  });

  it('adds new message to queryClient cache on message:new event', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['messages', 'chat-1'], []);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useChatSocket('chat-1'), { wrapper });

    const handler = mockSocket.on.mock.calls.find(([event]) => event === 'message:new')?.[1] as (
      msg: unknown,
    ) => void;

    const newMsg = { id: 'msg-new', chatId: 'chat-1', text: 'Hi', createdAt: '', updatedAt: '' };
    handler(newMsg);

    const cached = queryClient.getQueryData<unknown[]>(['messages', 'chat-1']);
    expect(cached).toContainEqual(newMsg);
  });

  it('does not add duplicate message if already in cache', () => {
    const existingMsg = { id: 'msg-1', chatId: 'chat-1', text: 'Hi', createdAt: '', updatedAt: '' };
    const queryClient = new QueryClient();
    queryClient.setQueryData(['messages', 'chat-1'], [existingMsg]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useChatSocket('chat-1'), { wrapper });

    const handler = mockSocket.on.mock.calls.find(([event]) => event === 'message:new')?.[1] as (
      msg: unknown,
    ) => void;

    handler(existingMsg);

    const cached = queryClient.getQueryData<unknown[]>(['messages', 'chat-1']);
    expect(cached).toHaveLength(1);
  });
});
