import type {
  Credentials,
  CredentialsPayload,
  CreateCredentialsInput,
  TokenPair,
  OAuthLoginDto,
  RefreshToken,
} from '@org/common';
import type { RegisterDto } from '../dto/register.dto';

export interface IAuthRepository {
  findByEmail(email: string): Promise<Credentials | null>;
  findById(id: string): Promise<Credentials | null>;
  createCredentials(data: CreateCredentialsInput): Promise<Credentials>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  findOAuthAccount(
    provider: string,
    providerId: string
  ): Promise<{ credentials: Credentials } | null>;
  createOAuthAccount(data: {
    provider: string;
    providerId: string;
    credentialsId: string;
  }): Promise<void>;
  saveRefreshToken(data: {
    tokenHash: string;
    credentialsId: string;
    expiresAt: Date;
  }): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshToken | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  verifyCredentials(id: string): Promise<void>;
  revokeAllRefreshTokens(credentialsId: string): Promise<void>;
  deleteUnverifiedOlderThan(before: Date): Promise<number>;
}

export interface IVerificationService {
  generateAndSend(credentialsId: string, email: string): Promise<void>;
  verify(token: string): Promise<string>;
  resend(email: string): Promise<void>;
  generatePasswordReset(credentialsId: string, email: string): Promise<void>;
  consumePasswordResetToken(token: string): Promise<string>;
}

export interface IAuthService {
  register(dto: RegisterDto): Promise<void>;
  validateCredentials(
    email: string,
    password: string
  ): Promise<CredentialsPayload>;
  login(id: string): Promise<TokenPair>;
  logout(refreshToken: string): Promise<void>;
  refresh(refreshToken: string): Promise<TokenPair>;
  verifyEmail(token: string): Promise<TokenPair>;
  resendVerification(email: string): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  oauthLogin(dto: OAuthLoginDto): Promise<TokenPair>;
}

export interface IAuthController {
  register(dto: RegisterDto): Promise<void>;
  validateCredentials(payload: {
    email: string;
    password: string;
  }): Promise<CredentialsPayload>;
  login(payload: { id: string }): Promise<TokenPair>;
  logout(payload: { refreshToken: string }): Promise<void>;
  refresh(payload: { refreshToken: string }): Promise<TokenPair>;
  verifyEmail(payload: { token: string }): Promise<TokenPair>;
  resendVerification(payload: { email: string }): Promise<void>;
  forgotPassword(payload: { email: string }): Promise<void>;
  resetPassword(payload: { token: string; newPassword: string }): Promise<void>;
  oauthLogin(dto: OAuthLoginDto): Promise<TokenPair>;
}
