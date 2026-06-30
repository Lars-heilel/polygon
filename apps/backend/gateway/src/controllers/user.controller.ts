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
@UseGuards(JwtGuard)
export class UserGatewayController {
  private readonly logger = new Logger(UserGatewayController.name);

  constructor(
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
      this.logger.error({ err: errObj }, 'RPC call failed');
      this.logger.debug('Full RPC error dump: %o', errObj);

      const rpcErr = err as Record<string, unknown>;
      const response = rpcErr.response as Record<string, unknown> | undefined;
      const message = (rpcErr.message ?? response?.message ?? 'Internal server error') as string;
      const rawStatus = (rpcErr.statusCode ?? rpcErr.status ?? response?.statusCode ?? 500) as number;
      const status = typeof rawStatus === 'number' ? rawStatus : 500;

      this.logger.warn(`RPC failed [${status}]: ${message}`);
      throw new HttpException(message, status);
    }
  }
}
