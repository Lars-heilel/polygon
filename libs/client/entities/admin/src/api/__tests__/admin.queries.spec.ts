import { API_ROUTES } from '@org/common';
import { authedFetch } from '@org/shared';

import { adminApi } from '../admin.api';
import { adminKeys } from '../admin.queries';

jest.mock('@org/shared', () => ({
  authedFetch: jest.fn(),
}));

const mockedAuthedFetch = jest.mocked(authedFetch);

describe('adminApi', () => {
  beforeEach(() => {
    mockedAuthedFetch.mockResolvedValue(undefined);
  });

  it('loads users through the shared Admin API route', async () => {
    await adminApi.users('alice@example.com');

    expect(mockedAuthedFetch).toHaveBeenCalledWith(
      `${API_ROUTES.admin.users}?query=alice%40example.com`,
    );
  });

  it('loads user details through the shared Admin API route', async () => {
    await adminApi.user('user-1');

    expect(mockedAuthedFetch).toHaveBeenCalledWith(API_ROUTES.admin.user('user-1'));
  });

  it('loads sessions through the shared Admin API route', async () => {
    await adminApi.sessions('user-1');

    expect(mockedAuthedFetch).toHaveBeenCalledWith(API_ROUTES.admin.sessions('user-1'));
  });

  it('revokes one session through the shared Admin API route', async () => {
    await adminApi.revokeSession('user-1', 'session-1');

    expect(mockedAuthedFetch).toHaveBeenCalledWith(API_ROUTES.admin.session('user-1', 'session-1'), {
      method: 'DELETE',
    });
  });

  it('revokes all sessions through the shared Admin API route', async () => {
    await adminApi.revokeAllSessions('user-1');

    expect(mockedAuthedFetch).toHaveBeenCalledWith(API_ROUTES.admin.sessions('user-1'), {
      method: 'DELETE',
    });
  });
});

describe('adminKeys', () => {
  it('uses stable query key factories', () => {
    expect(adminKeys.all).toEqual(['admin']);
    expect(adminKeys.users('alice')).toEqual(['admin', 'users', 'alice']);
    expect(adminKeys.user('user-1')).toEqual(['admin', 'user', 'user-1']);
    expect(adminKeys.sessions('user-1')).toEqual(['admin', 'user', 'user-1', 'sessions']);
  });
});
