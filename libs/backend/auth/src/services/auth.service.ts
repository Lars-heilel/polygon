import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  AUTH_PRISMA_REPOSITORY_TOKEN,
  EncryptionService,
  TokenService,
  USER_CLIENT_TOKEN,
  USER_EVENTS,
  VERIFICATION_SERVICE_TOKEN,
  type Env,
  type JwtPayload,
} from '@org/core';
import type {
  TokenPair,
  OAuthLoginDto,
  CredentialsPayload,
  Credentials,
} from '@org/common';
import type {
  IAuthRepository,
  IAuthService,
  IVerificationService,
} from '../interfaces/auth.interface';
import type { RegisterDto } from '../dto/register.dto';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    @Inject(AUTH_PRISMA_REPOSITORY_TOKEN)
    private readonly repo: IAuthRepository,
    private readonly encryption: EncryptionService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService<Env>,
    @Inject(VERIFICATION_SERVICE_TOKEN)
    private readonly verification: IVerificationService,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await this.encryption.hash(dto.password);
    const credentials = await this.repo.createCredentials({
      email: dto.email,
      passwordHash,
    });

    this.userClient.emit(USER_EVENTS.REGISTERED, {
      id: credentials.id,
      email: credentials.email,
      name: dto.username,
    });

    await this.verification.generateAndSend(credentials.id, credentials.email);

    return this.issueTokenPair(credentials);
  }

  async validateCredentials(
    email: string,
    password: string
  ): Promise<CredentialsPayload> {
    const credentials = await this.repo.findByEmail(email);
    if (!credentials || !credentials.passwordHash)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await this.encryption.compare(
      password,
      credentials.passwordHash
    );
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return {
      id: credentials.id,
      role: credentials.role,
      isVerified: credentials.isVerified,
    };
  }

  async login(id: string): Promise<TokenPair> {
    const credentials = await this.repo.findById(id);
    if (!credentials) throw new UnauthorizedException();
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
    if (!credentials || !credentials.passwordHash) return;
    await this.verification.generatePasswordReset(
      credentials.id,
      credentials.email
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const credentialsId = await this.verification.consumePasswordResetToken(
      token
    );
    const credentials = await this.repo.findById(credentialsId);
    if (!credentials) throw new NotFoundException('User not found');

    const passwordHash = await this.encryption.hash(newPassword);
    await this.repo.updatePasswordHash(credentialsId, passwordHash);
    await this.repo.revokeAllRefreshTokens(credentialsId);
  }

  async oauthLogin(dto: OAuthLoginDto): Promise<TokenPair> {
    const existing = await this.repo.findOAuthAccount(
      dto.provider,
      dto.providerId
    );
    if (existing) return this.issueTokenPair(existing.credentials);

    let credentials = await this.repo.findByEmail(dto.email);

    if (!credentials) {
      credentials = await this.repo.createCredentials({ email: dto.email });
      this.userClient.emit(USER_EVENTS.REGISTERED, {
        id: credentials.id,
        email: credentials.email,
        name: dto.name,
      });
    }

    await this.repo.createOAuthAccount({
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
    if (!stored || stored.revokedAt || stored.expiresAt < new Date())
      throw new UnauthorizedException();

    await this.repo.revokeRefreshToken(tokenHash);

    const credentials = await this.repo.findById(payload.sub);
    if (!credentials) throw new UnauthorizedException();

    return this.issueTokenPair(credentials);
  }

  private async issueTokenPair(
    credentials: Pick<Credentials, 'id' | 'role' | 'isVerified'>
  ): Promise<TokenPair> {
    const jwtPayload: JwtPayload = {
      sub: credentials.id,
      role: credentials.role as JwtPayload['role'],
      isVerified: credentials.isVerified,
    };

    const accessToken = this.tokenService.generateAccessToken(jwtPayload);
    const refreshToken = this.tokenService.generateRefreshToken(jwtPayload);

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() +
        this.config.get('JWT_REFRESH_TOKEN_EXPIRES', { infer: true })! * 1000
    );

    await this.repo.saveRefreshToken({
      tokenHash,
      credentialsId: credentials.id,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
