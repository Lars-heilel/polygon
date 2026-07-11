import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Logger,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AUTH_CLIENT_TOKEN,
  AUTH_PATTERNS,
  ActiveAccountGuard,
  CurrentUser,
  JwtGuard,
  type JwtPayload,
  SEARCH_CLIENT_TOKEN,
  SEARCH_PATTERNS,
  USER_CLIENT_TOKEN,
  USER_EVENTS,
  USER_PATTERNS,
} from '@org/core';
import { UpdateUserDto } from '@org/user';
import { Observable, lastValueFrom } from 'rxjs';

@ApiTags('users')
@ApiCookieAuth('access_token')
@Controller('users')
@UseGuards(JwtGuard, ActiveAccountGuard)
export class UserGatewayController {
  private readonly logger = new Logger(UserGatewayController.name);

  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
    @Inject(SEARCH_CLIENT_TOKEN) private readonly searchClient: ClientProxy,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getMe(@CurrentUser() jwt: JwtPayload) {
    const user = await this.send<{ role?: string }>(
      this.userClient.send(USER_PATTERNS.GET_BY_ID, { id: jwt.sub }),
    );
    return { ...user, role: jwt.role };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user public profile by ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User public profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getById(@Param('id') id: string) {
    return this.send(this.searchClient.send(SEARCH_PATTERNS.GET_USER_BY_ID, { id }));
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Get user full public profile by ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User full profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@Param('id') id: string) {
    const user = await this.send<{ id: string; email: string; name: string; displayName: string | null; avatarUrl: string | null; bio: string | null }>(
      this.userClient.send(USER_PATTERNS.GET_BY_ID, { id }),
    );
    const role = await this.send<'CREATOR' | 'ADMIN' | 'MODERATOR' | 'USER'>(
      this.authClient.send(AUTH_PATTERNS.GET_ROLE_BY_ID, { id }),
    );
    return {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      email: user.email,
      role,
    };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Updated user profile' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateUserDto) {
    const updated = await this.send(
      this.userClient.send(USER_PATTERNS.UPDATE, { id: user.sub, dto }),
    );
    this.searchClient.emit(USER_EVENTS.UPDATED, {
      id: user.sub,
      name: (updated as { name: string }).name,
      displayName: (updated as { displayName: string | null }).displayName,
      avatarUrl: (updated as { avatarUrl: string | null }).avatarUrl,
    });
    return updated;
  }

  private async send<T>(observable: Observable<T>): Promise<T> {
    try {
      return await lastValueFrom(observable);
    } catch (err) {
      const errObj = Object.getOwnPropertyNames(err).reduce(
        (acc, k) => ({ ...acc, [k]: (err as Record<string, unknown>)[k] }),
        {} as Record<string, unknown>,
      );
      this.logger.error({ err: this.rpcErrorSummary(errObj) }, 'RPC call failed');
      this.logger.debug({ err: this.rpcErrorSummary(errObj) }, 'RPC error context');

      const rpcErr = err as Record<string, unknown>;
      const response = rpcErr.response as Record<string, unknown> | undefined;
      const message = (rpcErr.message ?? response?.message ?? 'Internal server error') as string;
      const rawStatus = (rpcErr.statusCode ?? rpcErr.status ?? response?.statusCode ?? 500) as number;
      const status = typeof rawStatus === 'number' ? rawStatus : 500;

      this.logger.warn(`RPC failed [${status}]`);
      throw new HttpException(message, status);
    }
  }

  private rpcErrorSummary(err: Record<string, unknown>) {
    const response = err.response as Record<string, unknown> | undefined;
    return {
      name: typeof err.name === 'string' ? err.name : undefined,
      statusCode: err.statusCode ?? err.status ?? response?.statusCode,
      hasMessage: !!(err.message ?? response?.message),
      hasResponse: !!response,
    };
  }
}
