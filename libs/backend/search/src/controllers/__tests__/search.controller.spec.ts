import { NotFoundException } from '@nestjs/common';

import type { SearchService } from '../../services/search.service';
import { SearchController } from '../search.controller';

jest.mock('@org/core', () => ({
  SEARCH_PATTERNS: {
    SEARCH_USERS: 'search.users',
    GET_USER_BY_ID: 'search.getUserById',
    REINDEX_USERS: 'search.reindexUsers',
  },
  USER_EVENTS: {
    REGISTERED: 'user.registered',
    UPDATED: 'user.updated',
    DELETED: 'user.deleted',
  },
}));

describe('SearchController', () => {
  let searchService: {
    getUserById: jest.Mock;
    searchUsers: jest.Mock;
    indexUser: jest.Mock;
    removeUser: jest.Mock;
    reindexUsers: jest.Mock;
  };
  let controller: SearchController;

  beforeEach(() => {
    searchService = {
      getUserById: jest.fn(),
      searchUsers: jest.fn(),
      indexUser: jest.fn(),
      removeUser: jest.fn(),
      reindexUsers: jest.fn(),
    };
    controller = new SearchController(searchService as unknown as SearchService);
  });

  it('throws 404 when the index has no user', async () => {
    searchService.getUserById.mockResolvedValue(null);
    await expect(controller.getUserById({ id: 'user-1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('passes query options through to search', async () => {
    searchService.searchUsers.mockResolvedValue([]);
    await controller.searchUsers({ q: 'alice', limit: 20, offset: 0 });
    expect(searchService.searchUsers).toHaveBeenCalledWith('alice', {
      limit: 20,
      offset: 0,
    });
  });

  it('syncs registered users with null display fields', async () => {
    await controller.onUserRegistered({ id: 'user-1', name: 'alice' } as never);
    expect(searchService.indexUser).toHaveBeenCalledWith({
      id: 'user-1',
      name: 'alice',
      displayName: null,
      avatarUrl: null,
    });
  });

  it('syncs updates and deletes by id (redelivery-safe)', async () => {
    await controller.onUserUpdated({
      id: 'user-1',
      name: 'alice',
      displayName: null,
      avatarUrl: null,
    });
    expect(searchService.indexUser).toHaveBeenCalledTimes(1);
    await controller.onUserDeleted({ id: 'user-1' });
    expect(searchService.removeUser).toHaveBeenCalledWith('user-1');
  });

  it('reports the indexed count on reindex', async () => {
    await expect(controller.reindexUsers([])).resolves.toEqual({ indexed: 0 });
    expect(searchService.reindexUsers).toHaveBeenCalledWith([]);
  });
});
