import type {
  CreateCredentialsInput,
  Credentials,
  CredentialsPayload,
  OAuthLoginDto,
  Role,
  TokenPair,
} from '@org/common';
import type { ClientMetadata } from '@org/core';

import { DatabaseSession, SessionResponse } from '../dto';
import type { RegisterDto } from '../dto/register.dto';

export interface IAuthRepository {
  findByEmail(email: string): Promise<Credentials | null>;
  findById(id: string): Promise<Credentials | null>;
  createCredentials(data: CreateCredentialsInput): Promise<Credentials>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  findOAuthAccount(
    provider: string,
    providerId: string,
  ): Promise<{ credentials: Credentials } | null>;
  createOAuthAccount(data: {
    provider: string;
    providerId: string;
    credentialsId: string;
  }): Promise<void>;
  verifyCredentials(id: string): Promise<void>;
  deleteUnverifiedOlderThan(before: Date): Promise<number>;
  saveSession(data: {
    id: string;
    tokenHash: string;
    credentialsId: string;
    expiresAt: Date;
    ip?: string;
    country?: string;
    os?: string;
    browser?: string;
    device?: string;
    userAgent?: string;
  }): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<DatabaseSession | null>;
  revokeSession(tokenHash: string): Promise<void>;
  revokeAllSessions(credentialsId: string): Promise<void>;
  findActiveSessions(credentialsId: string): Promise<DatabaseSession[]>;
  findSessionById(sessionId: string): Promise<DatabaseSession | null>;
  updateSessionLastActive(sessionId: string): Promise<void>;
  updateSessionTokenHash(sessionId: string, newTokenHash: string): Promise<void>;
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
  getRoleById(id: string): Promise<Role>;
  validateCredentials(email: string, password: string): Promise<CredentialsPayload>;
  login(id: string, clientMetadata?: ClientMetadata): Promise<TokenPair>;
  logout(refreshToken: string): Promise<void>;
  refresh(refreshToken: string): Promise<TokenPair>;
  verifyEmail(token: string, clientMetadata?: ClientMetadata): Promise<TokenPair>;
  resendVerification(email: string): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  oauthLogin(dto: OAuthLoginDto, clientMetadata?: ClientMetadata): Promise<TokenPair>;
  listSessions(credentialsId: string, currentSessionId: string): Promise<SessionResponse[]>;
  revokeSession(sessionId: string, credentialsId: string): Promise<void>;
  revokeAllSessions(credentialsId: string): Promise<void>;
}

export interface IAuthController {
  register(dto: RegisterDto): Promise<null>;
  getRoleById(payload: { id: string }): Promise<Role>;
  validateCredentials(payload: { email: string; password: string }): Promise<CredentialsPayload>;
  login(payload: { id: string; clientMetadata?: ClientMetadata }): Promise<TokenPair>;
  logout(payload: { refreshToken: string }): Promise<null>;
  refresh(payload: { refreshToken: string }): Promise<TokenPair>;
  verifyEmail(payload: { token: string; clientMetadata?: ClientMetadata }): Promise<TokenPair>;
  resendVerification(payload: { email: string }): Promise<null>;
  forgotPassword(payload: { email: string }): Promise<null>;
  resetPassword(payload: { token: string; newPassword: string }): Promise<null>;
  oauthLogin(dto: OAuthLoginDto & { clientMetadata?: ClientMetadata }): Promise<TokenPair>;
  listSessions(payload: {
    credentialsId: string;
    currentSessionId: string;
  }): Promise<SessionResponse[]>;
  revokeSession(payload: { sessionId: string; credentialsId: string }): Promise<null>;
  revokeAllSessions(payload: { credentialsId: string }): Promise<null>;
}
