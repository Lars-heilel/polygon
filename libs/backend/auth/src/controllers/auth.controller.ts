import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { CredentialsPayload, OAuthLoginDto, TokenPair } from '@org/common';
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
  login(@Payload() payload: { id: string }): Promise<TokenPair> {
    return this.authService.login(payload.id);
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
  verifyEmail(@Payload() payload: { token: string }): Promise<TokenPair> {
    return this.authService.verifyEmail(payload.token);
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
  oauthLogin(@Payload() dto: OAuthLoginDto): Promise<TokenPair> {
    return this.authService.oauthLogin(dto);
  }
}
