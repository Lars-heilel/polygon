import { Controller, HttpException, Inject, Logger, UsePipes } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import {
  type AdminBanRequest,
  type AdminSessionsResponse,
  type CredentialsPayload,
  type OAuthLoginDto,
  type Role,
  type TokenPair,
} from '@org/common';
import type { ClientMetadata } from '@org/core';
import { AUTH_PATTERNS, AUTH_SERVICE_TOKEN } from '@org/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { AdminBanService } from '../admin/admin-ban.service';
import { SessionResponse } from '../dto';
import { RegisterDto } from '../dto/register.dto';
import type { AuthAdminAccount, IAuthController, IAuthService } from '../interfaces/auth.interface';

@Controller()
export class AuthController implements IAuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(AUTH_SERVICE_TOKEN) private readonly authService: IAuthService,
    private readonly adminService: AdminBanService,
  ) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  @UsePipes(new ZodValidationPipe(RegisterDto))
  async register(@Payload() dto: RegisterDto): Promise<null> {
    this.logger.log('RPC [REGISTER]: Received registration request');
    this.logger.debug({ hasEmail: !!dto.email, hasUsername: !!dto.username }, 'RPC [REGISTER]: Payload diagnostic');

    await this.rpc(() => this.authService.register(dto));
    this.logger.verbose('RPC [REGISTER]: Success response generated');
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.GET_ROLE_BY_ID)
  async getRoleById(@Payload() payload: { id: string }): Promise<Role> {
    this.logger.log('RPC [GET_ROLE_BY_ID]: Fetching role');
    this.logger.debug({ hasCredentialsId: !!payload.id }, 'RPC [GET_ROLE_BY_ID]: Payload diagnostic');
    return await this.rpc(() => this.authService.getRoleById(payload.id));
  }

  @MessagePattern(AUTH_PATTERNS.VALIDATE_CREDENTIALS)
  async validateCredentials(
    @Payload() payload: { email: string; password: string },
  ): Promise<CredentialsPayload> {
    this.logger.log('RPC [VALIDATE_CREDENTIALS]: Validation request received');

    return await this.rpc(() => this.authService.validateCredentials(payload.email, payload.password));
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  async login(
    @Payload() payload: { id: string; clientMetadata?: ClientMetadata },
  ): Promise<TokenPair> {
    this.logger.log('RPC [LOGIN]: Session creation requested');
    this.logger.debug(
      {
        hasCredentialsId: !!payload.id,
        hasClientMetadata: !!payload.clientMetadata,
        hasUserAgent: !!payload.clientMetadata?.userAgent,
        hasIp: !!payload.clientMetadata?.ip,
      },
      'RPC [LOGIN]: Payload diagnostic',
    );

    const tokens = await this.rpc(() => this.authService.login(payload.id, payload.clientMetadata));
    this.logger.verbose('RPC [LOGIN]: Completed session creation');
    return tokens;
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  async logout(@Payload() payload: { refreshToken: string }): Promise<null> {
    this.logger.log('RPC [LOGOUT]: Received request to terminate session');
    this.logger.verbose({ hasRefreshToken: !!payload.refreshToken }, 'RPC [LOGOUT]: Refresh token context');

    await this.rpc(() => this.authService.logout(payload.refreshToken));
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  async refresh(@Payload() payload: { refreshToken: string }): Promise<TokenPair> {
    this.logger.log('RPC [REFRESH]: Session token rotation request received');
    this.logger.verbose({ hasRefreshToken: !!payload.refreshToken }, 'RPC [REFRESH]: Received token parameters');

    return await this.rpc(() => this.authService.refresh(payload.refreshToken));
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY_EMAIL)
  async verifyEmail(
    @Payload() payload: { token: string; clientMetadata?: ClientMetadata },
  ): Promise<TokenPair> {
    this.logger.log('RPC [VERIFY_EMAIL]: Email verification confirmation triggered');
    this.logger.debug(
      { hasToken: !!payload.token, hasClientMetadata: !!payload.clientMetadata },
      'RPC [VERIFY_EMAIL]: Verification token and client metadata context',
    );

    return await this.rpc(() => this.authService.verifyEmail(payload.token, payload.clientMetadata));
  }

  @MessagePattern(AUTH_PATTERNS.RESEND_VERIFICATION)
  async resendVerification(@Payload() payload: { email: string }): Promise<null> {
    this.logger.log('RPC [RESEND_VERIFICATION]: Re-send requested');
    await this.rpc(() => this.authService.resendVerification(payload.email));
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD)
  async forgotPassword(@Payload() payload: { email: string }): Promise<null> {
    this.logger.log('RPC [FORGOT_PASSWORD]: Password reset triggered');
    await this.rpc(() => this.authService.forgotPassword(payload.email));
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  async resetPassword(@Payload() payload: { token: string; newPassword: string }): Promise<null> {
    this.logger.log('RPC [RESET_PASSWORD]: Consuming reset token to change password');
    this.logger.debug(
      { hasToken: !!payload.token },
      'RPC [RESET_PASSWORD]: Provided confirmation token',
    );

    await this.rpc(() => this.authService.resetPassword(payload.token, payload.newPassword));
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.OAUTH_LOGIN)
  async oauthLogin(
    @Payload() dto: OAuthLoginDto & { clientMetadata?: ClientMetadata },
  ): Promise<TokenPair> {
    this.logger.log(`RPC [OAUTH_LOGIN]: Authenticating via provider: ${dto.provider}`);
    this.logger.debug(
      { provider: dto.provider, hasEmail: !!dto.email, hasClientMetadata: !!dto.clientMetadata },
      'RPC [OAUTH_LOGIN]: OAuth payload and metadata details',
    );

    return await this.rpc(() => this.authService.oauthLogin(dto, dto.clientMetadata));
  }

  @MessagePattern(AUTH_PATTERNS.LIST_SESSIONS)
  async listSessions(
    @Payload() payload: { credentialsId: string; currentSessionId: string },
  ): Promise<SessionResponse[]> {
    this.logger.log('RPC [LIST_SESSIONS]: Listing sessions');
    this.logger.debug(
      {
        hasCredentialsId: !!payload.credentialsId,
        hasCurrentSessionId: !!payload.currentSessionId,
      },
      'RPC [LIST_SESSIONS]: Payload diagnostic',
    );
    return await this.rpc(() =>
      this.authService.listSessions(payload.credentialsId, payload.currentSessionId),
    );
  }

  @MessagePattern(AUTH_PATTERNS.REVOKE_SESSION)
  async revokeSession(
    @Payload() payload: { sessionId: string; credentialsId: string },
  ): Promise<null> {
    this.logger.log('RPC [REVOKE_SESSION]: Revoking session');
    this.logger.debug(
      { hasSessionId: !!payload.sessionId, hasCredentialsId: !!payload.credentialsId },
      'RPC [REVOKE_SESSION]: Payload diagnostic',
    );
    await this.rpc(() => this.authService.revokeSession(payload.sessionId, payload.credentialsId));
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.REVOKE_ALL_SESSIONS)
  async revokeAllSessions(@Payload() payload: { credentialsId: string }): Promise<null> {
    this.logger.log('RPC [REVOKE_ALL_SESSIONS]: Revoking all sessions');
    this.logger.debug(
      { hasCredentialsId: !!payload.credentialsId },
      'RPC [REVOKE_ALL_SESSIONS]: Payload diagnostic',
    );
    await this.rpc(() => this.authService.revokeAllSessions(payload.credentialsId));
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.GET_ADMIN_ACCOUNT)
  async getAdminAccount(
    @Payload() payload: { actorId: string; targetId: string },
  ): Promise<AuthAdminAccount> {
    return this.adminService.getAccount(payload.actorId, payload.targetId);
  }

  @MessagePattern(AUTH_PATTERNS.LIST_ADMIN_SESSIONS)
  async listAdminSessions(
    @Payload() payload: { actorId: string; targetId: string },
  ): Promise<AdminSessionsResponse> {
    return this.adminService.listSessions(payload.actorId, payload.targetId);
  }

  @MessagePattern(AUTH_PATTERNS.REVOKE_ADMIN_SESSION)
  async revokeAdminSession(
    @Payload() payload: { actorId: string; targetId: string; sessionId: string },
  ): Promise<null> {
    await this.adminService.revokeSession(payload.actorId, payload.targetId, payload.sessionId);
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.REVOKE_ALL_ADMIN_SESSIONS)
  async revokeAllAdminSessions(
    @Payload() payload: { actorId: string; targetId: string },
  ): Promise<null> {
    await this.adminService.revokeAllSessions(payload.actorId, payload.targetId);
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.BAN_ACCOUNT)
  async banAccount(
    @Payload() payload: { actorId: string; targetId: string; input: AdminBanRequest },
  ): Promise<null> {
    await this.adminService.ban(payload.actorId, payload.targetId, payload.input);
    return null;
  }

  @MessagePattern(AUTH_PATTERNS.UNBAN_ACCOUNT)
  async unbanAccount(@Payload() payload: { actorId: string; targetId: string }): Promise<null> {
    await this.adminService.unban(payload.actorId, payload.targetId);
    return null;
  }

  private async rpc<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) {
        throw new RpcException(this.httpExceptionPayload(error));
      }
      throw error;
    }
  }

  private httpExceptionPayload(error: HttpException): { statusCode: number; message: string } {
    const response = error.getResponse();
    const message =
      typeof response === 'object' &&
      response !== null &&
      'message' in response &&
      typeof response.message === 'string'
        ? response.message
        : error.message;

    return {
      statusCode: error.getStatus(),
      message,
    };
  }
}
