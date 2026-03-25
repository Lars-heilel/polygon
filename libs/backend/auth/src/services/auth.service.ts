import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { createHash, randomUUID } from 'crypto';
import {
  ConfigService,
  EncryptionService,
  TokenService,
  USER_CLIENT_TOKEN,
  USER_EVENTS,
  type JwtPayload,
} from '@org/core';
import { AuthPrismaRepository } from '../database/repository/auth.prisma.repo';
import type { RegisterDto } from '../dto/register.dto';
import type { LoginDto } from '../dto/login.dto';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthPrismaRepository,
    private readonly encryption: EncryptionService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await this.encryption.hash(dto.password);
    const credentials = await this.repo.createCredentials({
      id: randomUUID(),
      email: dto.email,
      passwordHash,
      createdAt: new Date(),
    });

    this.userClient.emit(USER_EVENTS.REGISTERED, {
      id: credentials.id,
      email: credentials.email,
      name: dto.username,
    });

    return this.issueTokenPair(credentials);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const credentials = await this.repo.findByEmail(dto.email);
    if (!credentials) throw new UnauthorizedException('Invalid credentials');

    const valid = await this.encryption.compare(dto.password, credentials.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokenPair(credentials);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.repo.findRefreshToken(tokenHash);

    if (!stored || stored.revokedAt) return;

    await this.repo.revokeRefreshToken(tokenHash);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException();
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.repo.findRefreshToken(tokenHash);

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException();
    }

    await this.repo.revokeRefreshToken(tokenHash);

    const credentials = await this.repo.findById(payload.sub);
    if (!credentials) throw new UnauthorizedException();

    return this.issueTokenPair(credentials);
  }

  private async issueTokenPair(credentials: {
    id: string;
    role: string;
    isVerified: boolean;
  }): Promise<TokenPair> {
    const jwtPayload: JwtPayload = {
      sub: credentials.id,
      role: credentials.role as JwtPayload['role'],
      isVerified: credentials.isVerified,
    };

    const accessToken = this.tokenService.generateAccessToken(jwtPayload);
    const refreshToken = this.tokenService.generateRefreshToken(jwtPayload);

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.config.jwtRefreshExpiresIn * 1000);

    await this.repo.saveRefreshToken({ tokenHash, credentialsId: credentials.id, expiresAt });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
