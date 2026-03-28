import { ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
import { VerificationService } from './verification.service';

export type OAuthLoginDto = {
  provider: string;
  providerId: string;
  email: string;
  name: string;
};

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
    private readonly verification: VerificationService,
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

    await this.verification.generateAndSend(credentials.id, credentials.email);

    return this.issueTokenPair(credentials);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const credentials = await this.repo.findByEmail(dto.email);
    if (!credentials || !credentials.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await this.encryption.compare(dto.password, credentials.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokenPair(credentials);
  }

  async verifyEmail(token: string): Promise<void> {
    await this.verification.verify(token);
  }

  async resendVerification(email: string): Promise<void> {
    await this.verification.resend(email);
  }

  async forgotPassword(email: string): Promise<void> {
    const credentials = await this.repo.findByEmail(email);
    // No error if user not found — prevents email enumeration
    if (!credentials || !credentials.passwordHash) return;
    await this.verification.generatePasswordReset(credentials.id, credentials.email);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const credentialsId = await this.verification.consumePasswordResetToken(token);
    const credentials = await this.repo.findById(credentialsId);
    if (!credentials) throw new NotFoundException('User not found');

    const passwordHash = await this.encryption.hash(newPassword);
    await this.repo.updatePasswordHash(credentialsId, passwordHash);
    await this.repo.revokeAllRefreshTokens(credentialsId);
  }

  async oauthLogin(dto: OAuthLoginDto): Promise<TokenPair> {
    const existing = await this.repo.findOAuthAccount(dto.provider, dto.providerId);

    if (existing) {
      return this.issueTokenPair(existing.credentials);
    }

    let credentials = await this.repo.findByEmail(dto.email);

    if (!credentials) {
      credentials = await this.repo.createCredentials({
        id: randomUUID(),
        email: dto.email,
        createdAt: new Date(),
      });

      this.userClient.emit(USER_EVENTS.REGISTERED, {
        id: credentials.id,
        email: credentials.email,
        name: dto.name,
      });
    }

    await this.repo.createOAuthAccount({
      id: randomUUID(),
      provider: dto.provider,
      providerId: dto.providerId,
      credentialsId: credentials.id,
    });

    if (!credentials.isVerified) {
      await this.repo.verifyCredentials(credentials.id);
      credentials = { ...credentials, isVerified: true };
    }

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
