import { act, renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { server } from '../../../test/server';
import { createWrapper } from '../../../test/test-utils';
import { useRegister } from '../model/use-register';

const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('useRegister', () => {
  const validValues = {
    email: 'user@example.com',
    password: 'Password1!',
    username: 'testuser',
  };

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('navigates to check-email with email param on success', async () => {
    const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.register(validValues);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/auth/check-email?email=user%40example.com'),
    );
    expect(result.current.apiError).toBeNull();
  });

  it('sets apiError on 409 conflict', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({ message: 'Email already in use' }, { status: 409 }),
      ),
    );

    const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.register(validValues);
    });

    expect(result.current.apiError).toBe('This email is already registered.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('sets generic apiError on server error', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({ message: 'Internal server error' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.register(validValues);
    });

    expect(result.current.apiError).toBe('Registration failed. Please try again.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('clears apiError on new submission', async () => {
    server.use(
      http.post(
        '/api/auth/register',
        () => HttpResponse.json({ message: 'Email already in use' }, { status: 409 }),
        { once: true },
      ),
    );

    const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.register(validValues);
    });
    expect(result.current.apiError).not.toBeNull();

    await act(async () => {
      await result.current.register(validValues);
    });

    expect(result.current.apiError).toBeNull();
  });
});
