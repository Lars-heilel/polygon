import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { Role, TokenPair } from '@org/common';

import type { Env } from '../config/env.schema';

export type JwtPayload = {
  sub: string;
  role: Role;
  isVerified: boolean;
  sessionId: string;
  jti: string;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env>,
  ) {}

  generateAccessToken(payload: JwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TOKEN_EXPIRES', { infer: true }),
    });
  }

  generateRefreshToken(payload: JwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_REFRESH_TOKEN_EXPIRES', { infer: true }),
    });
  }

  generateTokenPair(payload: Omit<JwtPayload, 'jti' | 'sessionId'>, sessionId: string): TokenPair {
    const jti = randomUUID();
    const fullPayload: JwtPayload = { ...payload, sessionId, jti };
    const accessToken = this.jwt.sign(fullPayload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TOKEN_EXPIRES', { infer: true }),
    });
    const refreshJti = randomUUID();
    const refreshPayload: JwtPayload = { ...payload, sessionId, jti: refreshJti };
    const refreshToken = this.jwt.sign(refreshPayload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_REFRESH_TOKEN_EXPIRES', { infer: true }),
    });
    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  verifyRefreshToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
    });
  }
}
