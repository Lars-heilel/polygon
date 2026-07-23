import { Controller, Get, HttpException, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '@org/auth';
import type { UserPublic, UserSearchResult } from '@org/common';
import { searchUsersQuerySchema } from '@org/common';
import {
  ActiveAccountGuard,
  SEARCH_CLIENT_TOKEN,
  SEARCH_PATTERNS,
  USER_CLIENT_TOKEN,
  USER_PATTERNS,
} from '@org/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { Observable, lastValueFrom } from 'rxjs';

@ApiTags('search')
@ApiCookieAuth('access_token')
@Controller('search')
@UseGuards(SessionGuard, ActiveAccountGuard)
export class SearchGatewayController {
  constructor(
    @Inject(SEARCH_CLIENT_TOKEN) private readonly searchClient: ClientProxy,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Search users by name or displayName' })
  @ApiResponse({ status: 200, description: 'Array of user search results' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  searchUsers(@Query(new ZodValidationPipe()) query: unknown): Promise<UserSearchResult[]> {
    const parsed = searchUsersQuerySchema.parse(query);
    return this.send(this.searchClient.send(SEARCH_PATTERNS.SEARCH_USERS, parsed));
  }

  @Post('reindex')
  @ApiOperation({ summary: 'Re-index all users in search engine' })
  @ApiResponse({ status: 201, description: 'Reindex triggered' })
  async reindex(): Promise<{ indexed: number }> {
    const users = await this.send<UserPublic[]>(
      this.userClient.send(USER_PATTERNS.GET_ALL_PUBLIC, {}),
    );
    return this.send(this.searchClient.send(SEARCH_PATTERNS.REINDEX_USERS, users));
  }

  private async send<T>(observable: Observable<T>): Promise<T> {
    try {
      return await lastValueFrom(observable);
    } catch (err) {
      const error = err as { statusCode?: number; message?: string };
      throw new HttpException(error.message ?? 'Internal server error', error.statusCode ?? 500);
    }
  }
}
