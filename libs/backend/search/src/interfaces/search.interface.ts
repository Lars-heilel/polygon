import type { UserSearchResult } from '@org/common';

export interface IUserSearchService {
  indexUser(user: UserSearchResult): Promise<void>;
  removeUser(id: string): Promise<void>;
  searchUsers(
    query: string,
    options?: { limit?: number; offset?: number },
  ): Promise<UserSearchResult[]>;
}
