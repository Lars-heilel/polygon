import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { CredentialsPayload, OAuthLoginDto, SessionInfo, TokenPair } from '@org/common';
import type { ClientMetadata } from '@org/core';
import { AUTH_PATTERNS, AUTH_SERVICE_TOKEN } from '@org/core';

import { RegisterDto } from '../dto/register.dto';
import type { IAuthController, IAuthService } from '../interfaces/auth.interface';

@Controller()
export class AuthController implements IAuthController {
  constructor(@Inject(AUTH_SERVICE_TOKEN) private readonly authService: IAuthService) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  register(@Payload() dto: RegisterDto): Promise<null> {
    return this.authService.register(dto).then(() => null);
  }

  @MessagePattern(AUTH_PATTERNS.VALIDATE_CREDENTIALS)
  validateCredentials(
    @Payload() payload: { email: string; password: string },
  ): Promise<CredentialsPayload> {
    return this.authService.validateCredentials(payload.email, payload.password);
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() payload: { id: string; clientMetadata?: ClientMetadata }): Promise<TokenPair> {
    return this.authService.login(payload.id, payload.clientMetadata);
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  logout(@Payload() payload: { refreshToken: string }): Promise<null> {
    return this.authService.logout(payload.refreshToken).then(() => null);
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  refresh(@Payload() payload: { refreshToken: string }): Promise<TokenPair> {
    return this.authService.refresh(payload.refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY_EMAIL)
  verifyEmail(@Payload() payload: { token: string; clientMetadata?: ClientMetadata }): Promise<TokenPair> {
    return this.authService.verifyEmail(payload.token, payload.clientMetadata);
  }

  @MessagePattern(AUTH_PATTERNS.RESEND_VERIFICATION)
  resendVerification(@Payload() payload: { email: string }): Promise<null> {
    return this.authService.resendVerification(payload.email).then(() => null);
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() payload: { email: string }): Promise<null> {
    return this.authService.forgotPassword(payload.email).then(() => null);
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() payload: { token: string; newPassword: string }): Promise<null> {
    return this.authService.resetPassword(payload.token, payload.newPassword).then(() => null);
  }

  @MessagePattern(AUTH_PATTERNS.OAUTH_LOGIN)
  oauthLogin(@Payload() dto: OAuthLoginDto & { clientMetadata?: ClientMetadata }): Promise<TokenPair> {
    return this.authService.oauthLogin(dto, dto.clientMetadata);
  }

  @MessagePattern(AUTH_PATTERNS.LIST_SESSIONS)
  listSessions(@Payload() payload: { credentialsId: string; currentSessionId: string }): Promise<SessionInfo[]> {
    return this.authService.listSessions(payload.credentialsId, payload.currentSessionId);
  }

  @MessagePattern(AUTH_PATTERNS.REVOKE_SESSION)
  revokeSession(@Payload() payload: { sessionId: string; credentialsId: string }): Promise<null> {
    return this.authService.revokeSession(payload.sessionId, payload.credentialsId).then(() => null);
  }

  @MessagePattern(AUTH_PATTERNS.REVOKE_ALL_SESSIONS)
  revokeAllSessions(@Payload() payload: { credentialsId: string }): Promise<null> {
    return this.authService.revokeAllSessions(payload.credentialsId).then(() => null);
  }
}
