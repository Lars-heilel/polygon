import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Role } from '@org/common';

import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtPayload } from '../token/token.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role as Role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
