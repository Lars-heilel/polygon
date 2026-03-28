import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { Request, Response } from 'express';
import { lastValueFrom, Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { AUTH_CLIENT_TOKEN, AUTH_PATTERNS, type Env } from '@org/core';
import type { TokenPair, CredentialsPayload } from '@org/common';
import { GithubGuard, GoogleGuard, LocalGuard, YandexGuard } from '@org/auth';
import { RegisterDto } from '../dto/register.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ForgotPasswordDto, ResetPasswordDto } from '../dto/reset-password.dto';

@Controller('auth')
export class AuthGatewayController {
  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
    private readonly config: ConfigService<Env>,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: any) {
    const response = res as Response;
    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.REGISTER, dto),
    );
    this.setTokenCookies(response, tokens);
    return { message: 'Registered successfully' };
  }

  @Post('login')
  @UseGuards(LocalGuard)
  async login(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const response = res as Response;
    const credentials = req.user as CredentialsPayload;
    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.LOGIN, { id: credentials.id }),
    );
    this.setTokenCookies(response, tokens);
    return { message: 'Logged in successfully' };
  }

  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const request = req as Request;
    const response = res as Response;
    const refreshToken = request.cookies?.['refresh_token'] as string | undefined;
    if (refreshToken) {
      await this.send(
        this.authClient.send(AUTH_PATTERNS.LOGOUT, { refreshToken }),
      );
    }
    this.clearTokenCookies(response);
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const request = req as Request;
    const response = res as Response;
    const refreshToken = request.cookies?.['refresh_token'] as string | undefined;
    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.REFRESH, { refreshToken }),
    );
    this.setTokenCookies(response, tokens);
    return { message: 'Tokens refreshed' };
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    await this.send(
      this.authClient.send(AUTH_PATTERNS.VERIFY_EMAIL, { token }),
    );
    return { message: 'Email verified successfully' };
  }

  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.send(
      this.authClient.send(AUTH_PATTERNS.RESEND_VERIFICATION, { email: dto.email }),
    );
    return { message: 'Verification email sent' };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.send(
      this.authClient.send(AUTH_PATTERNS.FORGOT_PASSWORD, { email: dto.email }),
    );
    // Always return success to prevent email enumeration
    return { message: 'If this email is registered, a reset link has been sent' };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.send(
      this.authClient.send(AUTH_PATTERNS.RESET_PASSWORD, {
        token: dto.token,
        newPassword: dto.newPassword,
      }),
    );
    return { message: 'Password reset successfully' };
  }

  // ── GitHub OAuth ──────────────────────────────────────────────────

  @Get('github')
  @UseGuards(GithubGuard)
  githubAuth() {
    // Passport redirects to GitHub — no body needed
  }

  @Get('github/callback')
  @UseGuards(GithubGuard)
  githubCallback(@Req() req: Request & { user: TokenPair }, @Res() res: Response) {
    this.setTokenCookies(res, req.user);
    res.redirect(this.config.get('CLIENT_URL', { infer: true })!);
  }

  // ── Yandex OAuth ──────────────────────────────────────────────────

  @Get('yandex')
  @UseGuards(YandexGuard)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  yandexAuth() {}

  @Get('yandex/callback')
  @UseGuards(YandexGuard)
  yandexCallback(@Req() req: Request & { user: TokenPair }, @Res() res: Response) {
    this.setTokenCookies(res, req.user);
    res.redirect(this.config.get('CLIENT_URL', { infer: true })!);
  }

  // ── Google OAuth ──────────────────────────────────────────────────

  @Get('google')
  @UseGuards(GoogleGuard)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleGuard)
  googleCallback(@Req() req: Request & { user: TokenPair }, @Res() res: Response) {
    this.setTokenCookies(res, req.user);
    res.redirect(this.config.get('CLIENT_URL', { infer: true })!);
  }

  private setTokenCookies(res: Response, tokens: TokenPair): void {
    const secure = this.config.get('NODE_ENV', { infer: true }) === 'production';
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: this.config.get('JWT_ACCESS_TOKEN_EXPIRES', { infer: true })! * 1000,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: this.config.get('JWT_REFRESH_TOKEN_EXPIRES', { infer: true })! * 1000,
    });
  }

  private clearTokenCookies(res: Response): void {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }

  private async send<T>(observable: Observable<T>): Promise<T> {
    try {
      return await lastValueFrom(observable);
    } catch (err) {
      const error = err as { statusCode?: number; message?: string };
      throw new HttpException(
        error.message ?? 'Internal server error',
        error.statusCode ?? 500,
      );
    }
  }
}
