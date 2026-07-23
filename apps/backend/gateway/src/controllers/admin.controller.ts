import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '@org/auth';
import {
  type AdminBanRequest,
  type AdminSessionsResponse,
  type AdminUserDetail,
  type AdminUserListItem,
  type AdminUserListResponse,
  type UserSearchResult,
  adminBanRequestSchema,
  adminUserQuerySchema,
} from '@org/common';
import {
  AUTH_CLIENT_TOKEN,
  AUTH_PATTERNS,
  ActiveAccountGuard,
  CurrentUser,
  type JwtPayload,
  MEDIA_CLIENT_TOKEN,
  MEDIA_PATTERNS,
  Roles,
  RolesGuard,
  SEARCH_CLIENT_TOKEN,
  SEARCH_PATTERNS,
  USER_CLIENT_TOKEN,
  USER_PATTERNS,
} from '@org/core';
import { Observable, lastValueFrom } from 'rxjs';

import { ChatSocketGateway } from '../gateways/chat.socket-gateway';

@ApiTags('admin')
@ApiCookieAuth('access_token')
@Controller('admin')
@UseGuards(SessionGuard, ActiveAccountGuard, RolesGuard)
@Roles('CREATOR', 'ADMIN')
export class AdminController {
  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
    @Inject(SEARCH_CLIENT_TOKEN) private readonly searchClient: ClientProxy,
    @Inject(MEDIA_CLIENT_TOKEN) private readonly mediaClient: ClientProxy,
    private readonly chatGateway: ChatSocketGateway,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Search accounts for administration' })
  @ApiResponse({ status: 200, description: 'Matching users' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async searchUsers(
    @Query() query: unknown,
    @CurrentUser() jwt: JwtPayload,
  ): Promise<AdminUserListResponse> {
    const parsed = parseOrBadRequest(adminUserQuerySchema, query);
    const results = await this.send<UserSearchResult[]>(
      this.searchClient.send(SEARCH_PATTERNS.SEARCH_USERS, { q: parsed.query }),
    );

    return Promise.all(
      results.map(async (result): Promise<AdminUserListItem> => {
        const authDetail = await this.send<{
          role: AdminUserListItem['role'];
          ban: AdminUserListItem['ban'];
        }>(
          this.authClient.send(AUTH_PATTERNS.GET_ADMIN_ACCOUNT, {
            actorId: jwt.sub,
            targetId: result.id,
          }),
        );

        return {
          ...result,
          role: authDetail.role,
          ban: authDetail.ban,
        };
      }),
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get aggregated administrative user detail' })
  @ApiParam({ name: 'id', description: 'Target account ID' })
  async getUser(
    @Param('id') targetId: string,
    @CurrentUser() jwt: JwtPayload,
  ): Promise<AdminUserDetail> {
    const [profile, authDetail] = await Promise.all([
      this.send<Record<string, unknown>>(this.userClient.send(USER_PATTERNS.GET_BY_ID, { id: targetId })),
      this.send<{
        id: string;
        email: string;
        role: AdminUserDetail['role'];
        oauthProviders: string[];
        ban: AdminUserDetail['ban'];
      }>(
        this.authClient.send(AUTH_PATTERNS.GET_ADMIN_ACCOUNT, {
          actorId: jwt.sub,
          targetId,
        }),
      ),
    ]);

    const [avatarHistory, sessions] = await Promise.all([
      this.send<AdminUserDetail['avatarHistory']>(
        this.mediaClient.send(MEDIA_PATTERNS.GET_ADMIN_AVATAR_HISTORY, { targetId }),
      ),
      this.send<AdminSessionsResponse>(
        this.authClient.send(AUTH_PATTERNS.LIST_ADMIN_SESSIONS, {
          actorId: jwt.sub,
          targetId,
        }),
      ),
    ]);

    return {
      id: authDetail.id,
      email: authDetail.email,
      role: authDetail.role,
      profile: profile as AdminUserDetail['profile'],
      oauthProviders: authDetail.oauthProviders,
      avatarHistory,
      sessionSummary: {
        activeCount: sessions.length,
        totalCount: sessions.length,
      },
      ban: authDetail.ban,
    };
  }

  @Get('users/:id/sessions')
  @ApiOperation({ summary: 'List target account sessions' })
  listSessions(
    @Param('id') targetId: string,
    @CurrentUser() jwt: JwtPayload,
  ): Promise<AdminSessionsResponse> {
    return this.send(
      this.authClient.send(AUTH_PATTERNS.LIST_ADMIN_SESSIONS, {
        actorId: jwt.sub,
        targetId,
      }),
    );
  }

  @Delete('users/:id/sessions/:sessionId')
  @ApiOperation({ summary: 'Revoke one target account session' })
  async revokeSession(
    @Param('id') targetId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() jwt: JwtPayload,
  ): Promise<{ message: string }> {
    await this.send(
      this.authClient.send(AUTH_PATTERNS.REVOKE_ADMIN_SESSION, {
        actorId: jwt.sub,
        targetId,
        sessionId,
      }),
    );

    return { message: 'Session revoked' };
  }

  @Delete('users/:id/sessions')
  @ApiOperation({ summary: 'Revoke all target account sessions' })
  async revokeAllSessions(
    @Param('id') targetId: string,
    @CurrentUser() jwt: JwtPayload,
  ): Promise<{ message: string }> {
    await this.send(
      this.authClient.send(AUTH_PATTERNS.REVOKE_ALL_ADMIN_SESSIONS, {
        actorId: jwt.sub,
        targetId,
      }),
    );

    return { message: 'All sessions revoked' };
  }

  @Post('users/:id/ban')
  @ApiOperation({ summary: 'Ban a target account' })
  async ban(
    @Param('id') targetId: string,
    @Body() body: unknown,
    @CurrentUser() jwt: JwtPayload,
  ): Promise<{ message: string }> {
    const input: AdminBanRequest = parseOrBadRequest(adminBanRequestSchema, body);

    await this.send(
      this.authClient.send(AUTH_PATTERNS.BAN_ACCOUNT, {
        actorId: jwt.sub,
        targetId,
        input,
      }),
    );

    this.chatGateway.disconnectUser(targetId);
    return { message: 'Account banned' };
  }

  @Delete('users/:id/ban')
  @ApiOperation({ summary: 'Unban a target account' })
  async unban(
    @Param('id') targetId: string,
    @CurrentUser() jwt: JwtPayload,
  ): Promise<{ message: string }> {
    await this.send(
      this.authClient.send(AUTH_PATTERNS.UNBAN_ACCOUNT, {
        actorId: jwt.sub,
        targetId,
      }),
    );

    return { message: 'Account unbanned' };
  }

  private async send<T>(observable: Observable<T>): Promise<T> {
    try {
      return await lastValueFrom(observable);
    } catch (err) {
      throw toHttpException(err);
    }
  }
}

function toHttpException(err: unknown): HttpException {
  const rpcError = err as Record<string, unknown>;
  const response = rpcError.response as Record<string, unknown> | string | undefined;
  const responseRecord = typeof response === 'object' && response !== null ? response : undefined;
  const message = (rpcError.message ?? responseRecord?.message ?? response ?? 'Internal server error') as
    | string
    | Record<string, unknown>;
  const rawStatus = rpcError.statusCode ?? rpcError.status ?? responseRecord?.statusCode ?? 500;
  const status = typeof rawStatus === 'number' ? rawStatus : 500;

  return new HttpException(responseRecord ?? message, status);
}

function parseOrBadRequest<T>(
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } },
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException('Invalid admin request');
  }
  return result.data;
}
