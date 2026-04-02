import { useSessionStore } from '@org/entities';
import { act, renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { server } from '../../../test/server';
import { createWrapper } from '../../../test/test-utils';
import { useLogout } from '../model/use-logout';

const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('useLogout', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useSessionStore.setState({ isAuthenticated: true, isLoading: false });
  });

  it('sets isAuthenticated=false and navigates to /auth/login on success', async () => {
    const { result } = renderHook(() => useLogout(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.logout();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(useSessionStore.getState().isAuthenticated).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login');
  });

  it('sets isAuthenticated=false and navigates to /auth/login even when request fails', async () => {
    server.use(http.post('/api/auth/logout', () => new HttpResponse(null, { status: 500 })));

    const { result } = renderHook(() => useLogout(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.logout();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(useSessionStore.getState().isAuthenticated).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login');
  });
});
