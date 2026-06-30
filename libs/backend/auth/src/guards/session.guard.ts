import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { SESSION_CACHE_REPOSITORY_TOKEN, TokenService } from '@org/core';
import type { JwtPayload } from '@org/core';

import type { ISessionCacheRepository } from '../cache/session.cache.interface';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    @Inject(SESSION_CACHE_REPOSITORY_TOKEN)
    private readonly sessionCache: ISessionCacheRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.['access_token'] as string | undefined;

    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: JwtPayload;
    try {
      payload = this.tokenService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException();
    }

    const sessionExists = await this.sessionCache.exists(payload.sessionId);
    if (!sessionExists) {
      throw new UnauthorizedException();
    }

    request['user'] = payload;
    return true;
  }
}
