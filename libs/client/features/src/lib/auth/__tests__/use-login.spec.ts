import { act, renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { server } from '../../../test/server';
import { createWrapper } from '../../../test/test-utils';
import { useLogin } from '../model/use-login';

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockToastError = vi.hoisted(() => vi.fn());
vi.mock('@org/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/shared')>();
  return { ...actual, toast: { ...actual.toast, error: mockToastError } };
});

describe('useLogin', () => {
  const validValues = {
    email: 'user@example.com',
    password: 'Password1!',
  };

  beforeEach(() => {
    mockNavigate.mockClear();
    mockToastError.mockClear();
  });

  it('navigates to /chats on successful login', async () => {
    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.login(validValues);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/chats');
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('shows generic error toast on wrong credentials (401)', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.login(validValues);
    });

    expect(mockToastError).toHaveBeenCalledWith('Invalid email or password');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // BUG: ISSUE-1 — all errors, including "Email not verified" (401) and rate-limit (429),
  // fall into the catch block and show a generic toast. The hook should inspect the HTTP
  // status and error body to differentiate:
  //   - 401 + "Email not verified" → toast with link/message about email verification
  //   - 429 → toast "Too many login attempts, please wait"
  //   - other 401 → "Invalid email or password"
  // These tests WILL FAIL until ISSUE-1 is fixed.

  it('[BUG ISSUE-1] shows verification message when email is not verified', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ message: 'Email not verified' }, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.login(validValues);
    });

    // Currently calls toast.error('Invalid email or password') regardless
    expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/verify your email/i));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('[BUG ISSUE-1] shows rate-limit message on 429', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ message: 'Too many requests' }, { status: 429 }),
      ),
    );

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.login(validValues);
    });

    // Currently calls toast.error('Invalid email or password') regardless
    expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/too many attempts/i));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('returns isPending=true while request is in flight', async () => {
    let resolveRequest!: () => void;
    server.use(
      http.post('/api/auth/login', async () => {
        await new Promise<void>((resolve) => {
          resolveRequest = resolve;
        });
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    act(() => {
      void result.current.login(validValues);
    });

    // Flush pending microtasks so the mutation starts
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isPending).toBe(true);
    resolveRequest();
  });
});
