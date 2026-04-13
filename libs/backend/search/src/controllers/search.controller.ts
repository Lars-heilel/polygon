import { Controller, NotFoundException } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import type { CreateUserEventInput, SearchUsersQuery, UserSearchResult } from '@org/common';
import { SEARCH_PATTERNS, USER_EVENTS } from '@org/core';

import { SearchService } from '../services/search.service';

@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @MessagePattern(SEARCH_PATTERNS.GET_USER_BY_ID)
  async getUserById(@Payload() payload: { id: string }): Promise<UserSearchResult> {
    const user = await this.searchService.getUserById(payload.id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @MessagePattern(SEARCH_PATTERNS.SEARCH_USERS)
  searchUsers(@Payload() payload: SearchUsersQuery): Promise<UserSearchResult[]> {
    return this.searchService.searchUsers(payload.q, {
      limit: payload.limit,
      offset: payload.offset,
    });
  }

  @EventPattern(USER_EVENTS.REGISTERED)
  async onUserRegistered(@Payload() data: CreateUserEventInput): Promise<void> {
    await this.searchService.indexUser({
      id: data.id,
      name: data.name,
      displayName: null,
      avatarUrl: null,
    });
  }

  @EventPattern(USER_EVENTS.UPDATED)
  async onUserUpdated(
    @Payload()
    data: {
      id: string;
      name: string;
      displayName: string | null;
      avatarUrl: string | null;
    },
  ): Promise<void> {
    await this.searchService.indexUser(data);
  }

  @EventPattern(USER_EVENTS.DELETED)
  async onUserDeleted(@Payload() data: { id: string }): Promise<void> {
    await this.searchService.removeUser(data.id);
  }

  @MessagePattern(SEARCH_PATTERNS.REINDEX_USERS)
  async reindexUsers(@Payload() users: UserSearchResult[]): Promise<{ indexed: number }> {
    await this.searchService.reindexUsers(users);
    return { indexed: users.length };
  }
}
