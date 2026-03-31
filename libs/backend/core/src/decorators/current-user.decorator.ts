import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import type { JwtPayload } from '../token/token.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    return ctx.switchToHttp().getRequest().user as JwtPayload;
  },
);
