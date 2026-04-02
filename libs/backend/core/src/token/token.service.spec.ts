import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { TokenService } from './token.service';
import type { JwtPayload } from './token.service';

const ACCESS_SECRET = 'test-access-secret';
const REFRESH_SECRET = 'test-refresh-secret';
const ACCESS_EXPIRES = 900; // 15 min in seconds
const REFRESH_EXPIRES = 604800; // 7 days in seconds

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'JWT_ACCESS_SECRET') return ACCESS_SECRET;
    if (key === 'JWT_REFRESH_SECRET') return REFRESH_SECRET;
    if (key === 'JWT_ACCESS_TOKEN_EXPIRES') return ACCESS_EXPIRES;
    if (key === 'JWT_REFRESH_TOKEN_EXPIRES') return REFRESH_EXPIRES;
    return undefined;
  }),
};

describe('TokenService', () => {
  let service: TokenService;

  const payload: JwtPayload = {
    sub: 'user-id-123',
    role: 'USER',
    isVerified: true,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TokenService, JwtService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();

    service = module.get(TokenService);
  });

  describe('generateAccessToken', () => {
    it('returns a non-empty JWT string', () => {
      const token = service.generateAccessToken(payload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('encodes the sub, role, and isVerified into the token', () => {
      const token = service.generateAccessToken(payload);
      const decoded = service.verifyAccessToken(token);

      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.isVerified).toBe(payload.isVerified);
    });
  });

  describe('generateRefreshToken', () => {
    it('returns a non-empty JWT string', () => {
      const token = service.generateRefreshToken(payload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('access and refresh tokens for the same payload are different (different secrets)', () => {
      const access = service.generateAccessToken(payload);
      const refresh = service.generateRefreshToken(payload);

      expect(access).not.toBe(refresh);
    });
  });

  describe('verifyAccessToken', () => {
    it('returns the original payload', () => {
      const token = service.generateAccessToken(payload);
      const decoded = service.verifyAccessToken(token);

      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.isVerified).toBe(payload.isVerified);
    });

    it('throws when signed with the wrong secret', () => {
      // Generate with refresh secret, try to verify as access token
      const token = service.generateRefreshToken(payload);

      expect(() => service.verifyAccessToken(token)).toThrow();
    });

    it('throws on a tampered token', () => {
      const token = service.generateAccessToken(payload);
      const tampered = token.slice(0, -5) + 'XXXXX';

      expect(() => service.verifyAccessToken(tampered)).toThrow();
    });

    it('throws on an expired token', async () => {
      // Sign a token that expired 1 second ago
      const jwtService = new JwtService();
      const expired = jwtService.sign(payload, {
        secret: ACCESS_SECRET,
        expiresIn: -1,
      });

      expect(() => service.verifyAccessToken(expired)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('returns the original payload', () => {
      const token = service.generateRefreshToken(payload);
      const decoded = service.verifyRefreshToken(token);

      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.isVerified).toBe(payload.isVerified);
    });

    it('throws when signed with the wrong secret', () => {
      // Generate with access secret, try to verify as refresh token
      const token = service.generateAccessToken(payload);

      expect(() => service.verifyRefreshToken(token)).toThrow();
    });
  });
});
