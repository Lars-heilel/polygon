import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '@org/core';
import { AuthService } from '../services/auth.service';
import type { OAuthLoginDto } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  register(@Payload() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  logout(@Payload() payload: { refreshToken: string }) {
    return this.authService.logout(payload.refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  refresh(@Payload() payload: { refreshToken: string }) {
    return this.authService.refresh(payload.refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY_EMAIL)
  verifyEmail(@Payload() payload: { token: string }) {
    return this.authService.verifyEmail(payload.token);
  }

  @MessagePattern(AUTH_PATTERNS.RESEND_VERIFICATION)
  resendVerification(@Payload() payload: { email: string }) {
    return this.authService.resendVerification(payload.email);
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() payload: { email: string }) {
    return this.authService.forgotPassword(payload.email);
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() payload: { token: string; newPassword: string }) {
    return this.authService.resetPassword(payload.token, payload.newPassword);
  }

  @MessagePattern(AUTH_PATTERNS.OAUTH_LOGIN)
  oauthLogin(@Payload() dto: OAuthLoginDto) {
    return this.authService.oauthLogin(dto);
  }
}
