import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { UserSearchResult } from '@org/common';
import type { ISearchProvider } from '@org/core';
import { REDIS_CLIENT, SEARCH_PROVIDER_TOKEN } from '@org/core';
import type Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

import type { IUserSearchService } from '../interfaces/search.interface';

const USERS_INDEX = 'users';
const REINDEX_LOCK_KEY = 'search:reindex:lock';
const REINDEX_LOCK_TTL_SECONDS = 300;

@Injectable()
export class SearchService implements IUserSearchService, OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(SEARCH_PROVIDER_TOKEN) private readonly provider: ISearchProvider,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.provider.configureIndex(USERS_INDEX, {
      searchableAttributes: ['name', 'displayName'],
    });
  }

  async indexUser(user: UserSearchResult): Promise<void> {
    this.logger.log({ eventType: 'search_index_request' });
    await this.provider.upsert(USERS_INDEX, user);
    this.logger.log({ eventType: 'search_index_done' });
  }

  async removeUser(id: string): Promise<void> {
    this.logger.log({ eventType: 'search_remove_request' });
    await this.provider.delete(USERS_INDEX, id);
    this.logger.log({ eventType: 'search_remove_done' });
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

  async reindexUsers(users: UserSearchResult[]): Promise<void> {
    this.logger.log({ eventType: 'search_reindex_request', userCount: users.length });
    const token = randomUUID();
    const acquired = await this.redis.set(
      REINDEX_LOCK_KEY,
      token,
      'EX',
      REINDEX_LOCK_TTL_SECONDS,
      'NX',
    );
    if (acquired !== 'OK') {
      this.logger.warn({ eventType: 'search_reindex_skipped_lock_held' });
      return;
    }
    try {
      await this.provider.clearIndex(USERS_INDEX);
      await this.provider.bulkUpsert(USERS_INDEX, users);
    } finally {
      await this.redis.del(REINDEX_LOCK_KEY);
    }
    this.logger.log({ eventType: 'search_reindex_done', userCount: users.length });
  }
}
