import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../token/token.service';
import { TokenService } from '../token/token.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.['access_token'] as string | undefined;

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      request['user'] = this.tokenService.verifyAccessToken(token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
