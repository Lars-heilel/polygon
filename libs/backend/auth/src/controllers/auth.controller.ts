import { Controller, Inject, Logger, UsePipes } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { type CredentialsPayload, type OAuthLoginDto, type TokenPair } from '@org/common';
import type { ClientMetadata } from '@org/core';
import { AUTH_PATTERNS, AUTH_SERVICE_TOKEN } from '@org/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { SessionResponse } from '../dto';
import { RegisterDto } from '../dto/register.dto';
import type { IAuthController, IAuthService } from '../interfaces/auth.interface';

@Controller()
export class AuthController implements IAuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(@Inject(AUTH_SERVICE_TOKEN) private readonly authService: IAuthService) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  @UsePipes(new ZodValidationPipe(RegisterDto))
  async register(@Payload() dto: RegisterDto): Promise<null> {
    this.logger.log(`RPC [REGISTER]: Received request for email: ${dto.email}`);
    this.logger.debug({ dto }, 'RPC [REGISTER]: Full payload diagnostic');

    await this.authService.register(dto);
    this.logger.verbose(`RPC [REGISTER]: Success response generated for email: ${dto.email}`);
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.VALIDATE_CREDENTIALS)
  async validateCredentials(
    @Payload() payload: { email: string; password: string },
  ): Promise<CredentialsPayload> {
    this.logger.log(`RPC [VALIDATE_CREDENTIALS]: Validation request for email: ${payload.email}`);

    return await this.authService.validateCredentials(payload.email, payload.password);
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  async login(
    @Payload() payload: { id: string; clientMetadata?: ClientMetadata },
  ): Promise<TokenPair> {
    this.logger.log(`RPC [LOGIN]: Session creation requested for ID: ${payload.id}`);
    this.logger.debug({ payload }, 'RPC [LOGIN]: Client metadata and payload context');

    const tokens = await this.authService.login(payload.id, payload.clientMetadata);
    this.logger.verbose(`RPC [LOGIN]: Completed session creation for ID: ${payload.id}`);
    return tokens;
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  async logout(@Payload() payload: { refreshToken: string }): Promise<null> {
    this.logger.log('RPC [LOGOUT]: Received request to terminate session');
    this.logger.verbose({ payload }, 'RPC [LOGOUT]: Refresh token context');

    await this.authService.logout(payload.refreshToken);
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  async refresh(@Payload() payload: { refreshToken: string }): Promise<TokenPair> {
    this.logger.log('RPC [REFRESH]: Session token rotation request received');
    this.logger.verbose({ payload }, 'RPC [REFRESH]: Received token parameters');

    return await this.authService.refresh(payload.refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY_EMAIL)
  async verifyEmail(
    @Payload() payload: { token: string; clientMetadata?: ClientMetadata },
  ): Promise<TokenPair> {
    this.logger.log('RPC [VERIFY_EMAIL]: Email verification confirmation triggered');
    this.logger.debug(
      { payload },
      'RPC [VERIFY_EMAIL]: Verification token and client metadata context',
    );

    return await this.authService.verifyEmail(payload.token, payload.clientMetadata);
  }

  @MessagePattern(AUTH_PATTERNS.RESEND_VERIFICATION)
  async resendVerification(@Payload() payload: { email: string }): Promise<null> {
    this.logger.log(`RPC [RESEND_VERIFICATION]: Re-send requested for email: ${payload.email}`);
    await this.authService.resendVerification(payload.email);
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD)
  async forgotPassword(@Payload() payload: { email: string }): Promise<null> {
    this.logger.log(`RPC [FORGOT_PASSWORD]: Password reset triggered for: ${payload.email}`);
    await this.authService.forgotPassword(payload.email);
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  async resetPassword(@Payload() payload: { token: string; newPassword: string }): Promise<null> {
    this.logger.log('RPC [RESET_PASSWORD]: Consuming reset token to change password');
    this.logger.debug(
      { token: payload.token },
      'RPC [RESET_PASSWORD]: Provided confirmation token',
    );

    await this.authService.resetPassword(payload.token, payload.newPassword);
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.OAUTH_LOGIN)
  async oauthLogin(
    @Payload() dto: OAuthLoginDto & { clientMetadata?: ClientMetadata },
  ): Promise<TokenPair> {
    this.logger.log(`RPC [OAUTH_LOGIN]: Authenticating via provider: ${dto.provider}`);
    this.logger.debug({ dto }, 'RPC [OAUTH_LOGIN]: OAuth payload and metadata details');

    return await this.authService.oauthLogin(dto, dto.clientMetadata);
  }

  @MessagePattern(AUTH_PATTERNS.LIST_SESSIONS)
  async listSessions(
    @Payload() payload: { credentialsId: string; currentSessionId: string },
  ): Promise<SessionResponse[]> {
    this.logger.log(`RPC [LIST_SESSIONS]: Listing sessions for user: ${payload.credentialsId}`);
    return await this.authService.listSessions(payload.credentialsId, payload.currentSessionId);
  }

  @MessagePattern(AUTH_PATTERNS.REVOKE_SESSION)
  async revokeSession(
    @Payload() payload: { sessionId: string; credentialsId: string },
  ): Promise<null> {
    this.logger.log(`RPC [REVOKE_SESSION]: Revoking session: ${payload.sessionId}`);
    await this.authService.revokeSession(payload.sessionId, payload.credentialsId);
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.REVOKE_ALL_SESSIONS)
  async revokeAllSessions(@Payload() payload: { credentialsId: string }): Promise<null> {
    this.logger.log(
      `RPC [REVOKE_ALL_SESSIONS]: Revoking all sessions for user: ${payload.credentialsId}`,
    );
    await this.authService.revokeAllSessions(payload.credentialsId);
    return null;
  }
}
