import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AUTH_PATTERNS, AUTH_SERVICE_TOKEN } from '@org/core';
import type { OAuthLoginDto, TokenPair, CredentialsPayload } from '@org/common';
import type { IAuthController, IAuthService } from '../interfaces/auth.interface';
import { RegisterDto } from '../dto/register.dto';

@Controller()
export class AuthController implements IAuthController {
  constructor(
    @Inject(AUTH_SERVICE_TOKEN) private readonly authService: IAuthService,
  ) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  register(@Payload() dto: RegisterDto): Promise<TokenPair> {
    return this.authService.register(dto);
  }

  @MessagePattern(AUTH_PATTERNS.VALIDATE_CREDENTIALS)
  validateCredentials(@Payload() payload: { email: string; password: string }): Promise<CredentialsPayload> {
    return this.authService.validateCredentials(payload.email, payload.password);
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() payload: { id: string }): Promise<TokenPair> {
    return this.authService.login(payload.id);
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  logout(@Payload() payload: { refreshToken: string }): Promise<void> {
    return this.authService.logout(payload.refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  refresh(@Payload() payload: { refreshToken: string }): Promise<TokenPair> {
    return this.authService.refresh(payload.refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY_EMAIL)
  verifyEmail(@Payload() payload: { token: string }): Promise<void> {
    return this.authService.verifyEmail(payload.token);
  }

  @MessagePattern(AUTH_PATTERNS.RESEND_VERIFICATION)
  resendVerification(@Payload() payload: { email: string }): Promise<void> {
    return this.authService.resendVerification(payload.email);
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() payload: { email: string }): Promise<void> {
    return this.authService.forgotPassword(payload.email);
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() payload: { token: string; newPassword: string }): Promise<void> {
    return this.authService.resetPassword(payload.token, payload.newPassword);
  }

  @MessagePattern(AUTH_PATTERNS.OAUTH_LOGIN)
  oauthLogin(@Payload() dto: OAuthLoginDto): Promise<TokenPair> {
    return this.authService.oauthLogin(dto);
  }
}
