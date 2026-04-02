import { act, renderHook } from '@testing-library/react';

import { createWrapper } from '../../../../test/test-utils';
import { useSendMessage } from '../model/use-send-message';

const mockMutate = vi.hoisted(() => vi.fn());
const mockUseSendMessageMutation = vi.hoisted(() => vi.fn());

vi.mock('@org/entities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/entities')>();
  return {
    ...actual,
    useSendMessageMutation: mockUseSendMessageMutation,
  };
});

const mockToastError = vi.hoisted(() => vi.fn());
vi.mock('@org/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/shared')>();
  return { ...actual, toast: { ...actual.toast, error: mockToastError } };
});

describe('useSendMessage', () => {
  beforeEach(() => {
    mockMutate.mockClear();
    mockToastError.mockClear();
    mockUseSendMessageMutation.mockReturnValue({ mutate: mockMutate, isPending: false });
  });

  it('send does nothing when text is empty', () => {
    const { result } = renderHook(() => useSendMessage('chat-1'), { wrapper: createWrapper() });

    act(() => result.current.send());

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('send does nothing when isPending is true', () => {
    mockUseSendMessageMutation.mockReturnValue({ mutate: mockMutate, isPending: true });

    const { result } = renderHook(() => useSendMessage('chat-1'), { wrapper: createWrapper() });

    act(() => result.current.setText('Hello'));
    act(() => result.current.send());

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('clears text after calling send with valid text', () => {
    const { result } = renderHook(() => useSendMessage('chat-1'), { wrapper: createWrapper() });

    act(() => result.current.setText('Hello'));
    act(() => result.current.send());

    expect(mockMutate).toHaveBeenCalledWith('Hello', expect.any(Object));
    expect(result.current.text).toBe('');
  });

  it('restores text and shows toast on mutation error', () => {
    const { result } = renderHook(() => useSendMessage('chat-1'), { wrapper: createWrapper() });

    act(() => result.current.setText('Hello'));
    act(() => result.current.send());

    const { onError } = mockMutate.mock.calls[0][1] as { onError: () => void };
    act(() => onError());

    expect(mockToastError).toHaveBeenCalledWith('Failed to send message');
    expect(result.current.text).toBe('Hello');
  });
});
