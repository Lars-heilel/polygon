import type { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';

import { SEARCH_PATTERNS } from '@org/core';

import { SearchGatewayController } from '../search.controller';

jest.mock('@org/auth', () => ({
  SessionGuard: class MockSessionGuard {},
}));

describe('SearchGatewayController', () => {
  let searchClient: { send: jest.Mock };
  let userClient: { send: jest.Mock };
  let controller: SearchGatewayController;

  beforeEach(() => {
    searchClient = { send: jest.fn() };
    userClient = { send: jest.fn() };
    controller = new SearchGatewayController(
      searchClient as unknown as ClientProxy,
      userClient as unknown as ClientProxy,
    );
  });

  it('forwards a validated query to search.users', async () => {
    searchClient.send.mockReturnValue(of([]));
    await expect(controller.searchUsers({ q: 'alice', limit: 20, offset: 0 })).resolves.toEqual(
      [],
    );
    expect(searchClient.send).toHaveBeenCalledWith(SEARCH_PATTERNS.SEARCH_USERS, {
      q: 'alice',
      limit: 20,
      offset: 0,
    });
  });

  it('maps RPC errors to HttpException with status', async () => {
    searchClient.send.mockReturnValue(
      throwError(() => ({ message: 'Search unavailable', statusCode: 503 })),
    );
    await expect(controller.searchUsers({ q: 'alice' })).rejects.toMatchObject({
      message: 'Search unavailable',
      status: 503,
    });
  });

  it('reindexes from user.getAllPublic', async () => {
    const users = [
      {
        id: '0197f96c-b278-7f64-a32f-d44a57f6726b',
        name: 'alice',
        displayName: null,
        avatarUrl: null,
      },
    ];
    userClient.send.mockReturnValue(of(users));
    searchClient.send.mockReturnValue(of({ indexed: 1 }));
    await expect(controller.reindex()).resolves.toEqual({ indexed: 1 });
  });
});
