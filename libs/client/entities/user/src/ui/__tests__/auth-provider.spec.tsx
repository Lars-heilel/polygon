import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authApi } from '../../api/user.api';
import { useSessionStore } from '../../model/session.store';
import { AuthBootstrap } from '../auth-provider';

function resetSessionStore() {
  useSessionStore.setState({ isAuthenticated: false, isLoading: true });
}

describe('AuthBootstrap', () => {
  afterEach(() => {
    resetSessionStore();
  });

  it('marks the session authenticated when the current user request succeeds', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      displayName: null,
      avatarUrl: null,
      bio: null,
      role: 'USER',
    });

    render(<AuthBootstrap />);

    await waitFor(() => {
      expect(useSessionStore.getState()).toMatchObject({
        isAuthenticated: true,
        isLoading: false,
      });
    });
  });

  it('marks the session unauthenticated when the current user request fails', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValue(new Error('Unauthorized'));

    render(<AuthBootstrap />);

    await waitFor(() => {
      expect(useSessionStore.getState()).toMatchObject({
        isAuthenticated: false,
        isLoading: false,
      });
    });
  });
});
