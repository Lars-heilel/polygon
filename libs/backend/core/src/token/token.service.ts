import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import type { Role } from '@org/common';

export type JwtPayload = {
  sub: string;
  role: Role;
  isVerified: boolean;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  generateAccessToken(payload: JwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.jwtAccessSecret,
      expiresIn: this.config.jwtAccessExpiresIn,
    });
  }

  generateRefreshToken(payload: JwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.jwtRefreshSecret,
      expiresIn: this.config.jwtRefreshExpiresIn,
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token, {
      secret: this.config.jwtAccessSecret,
    });
  }

  verifyRefreshToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token, {
      secret: this.config.jwtRefreshSecret,
    });
  }
}
