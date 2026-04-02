import { act, renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { server } from '../../../test/server';
import { createWrapper } from '../../../test/test-utils';
import { useForgotPassword } from '../model/use-forgot-password';

const mockToastSuccess = vi.hoisted(() => vi.fn());
vi.mock('@org/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/shared')>();
  return { ...actual, toast: { ...actual.toast, success: mockToastSuccess } };
});

describe('useForgotPassword', () => {
  beforeEach(() => {
    mockToastSuccess.mockClear();
  });

  it('shows success toast on successful request', async () => {
    const { result } = renderHook(() => useForgotPassword(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.forgotPassword('user@example.com');
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringMatching(/reset link sent/i));
  });

  it('returns isPending=true while request is in flight', async () => {
    let resolveRequest!: () => void;
    server.use(
      http.post('/api/auth/forgot-password', async () => {
        await new Promise<void>((resolve) => {
          resolveRequest = resolve;
        });
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { result } = renderHook(() => useForgotPassword(), { wrapper: createWrapper() });

    act(() => {
      void result.current.forgotPassword('user@example.com');
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isPending).toBe(true);
    resolveRequest();
  });
});
