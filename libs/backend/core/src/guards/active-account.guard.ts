import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { BanMarkerRepository } from '../ban/ban-marker.repository';
import type { JwtPayload } from '../token/token.service';

type AuthenticatedRequest = Request & { user?: Partial<JwtPayload> };

@Injectable()
export class ActiveAccountGuard implements CanActivate {
  constructor(private readonly banMarkers: BanMarkerRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException();
    }

    let marker;
    try {
      marker = await this.banMarkers.findActiveMarker(userId);
    } catch {
      throw new ServiceUnavailableException({ code: 'ACCOUNT_BAN_CHECK_UNAVAILABLE' });
    }

    if (marker) {
      throw new ForbiddenException({
        code: 'ACCOUNT_BANNED',
        reason: marker.reason,
        bannedUntil: marker.bannedUntil,
      });
    }

    return true;
  }
}
