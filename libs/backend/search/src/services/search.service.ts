import { Inject, Injectable } from '@nestjs/common';
import type { UserSearchResult } from '@org/common';
import type { ISearchProvider } from '@org/core';
import { SEARCH_PROVIDER_TOKEN } from '@org/core';

import type { IUserSearchService } from '../interfaces/search.interface';

const USERS_INDEX = 'users';

@Injectable()
export class SearchService implements IUserSearchService {
  constructor(@Inject(SEARCH_PROVIDER_TOKEN) private readonly provider: ISearchProvider) {}

  async indexUser(user: UserSearchResult): Promise<void> {
    await this.provider.upsert(USERS_INDEX, user);
  }

  async removeUser(id: string): Promise<void> {
    await this.provider.delete(USERS_INDEX, id);
  }

  async getUserById(id: string): Promise<UserSearchResult | null> {
    return this.provider.getById<UserSearchResult>(USERS_INDEX, id);
  }

  async searchUsers(
    query: string,
    options?: { limit?: number; offset?: number },
  ): Promise<UserSearchResult[]> {
    const hits = await this.provider.search<UserSearchResult>(USERS_INDEX, query, options);
    return hits.map((hit) => hit.document);
  }
}
