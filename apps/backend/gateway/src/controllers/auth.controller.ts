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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiQuery,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
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

@ApiTags('auth')
@Controller('auth')
export class AuthGatewayController {
  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
    private readonly config: ConfigService<Env>
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user with email and password' })
  @ApiResponse({ status: 201, description: 'Registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async register(@Body() dto: RegisterDto) {
    await this.send(this.authClient.send(AUTH_PATTERNS.REGISTER, dto));
    return { message: 'Registered successfully' };
  }

  @Post('login')
  @UseGuards(LocalGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 201, description: 'Logged in — sets access_token and refresh_token cookies' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or email not verified' })
  @ApiResponse({ status: 429, description: 'Too many failed attempts' })
  async login(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const response = res as Response;
    const credentials = req.user as CredentialsPayload;
    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.LOGIN, { id: credentials.id })
    );
    this.setTokenCookies(response, tokens);
    return { message: 'Logged in successfully' };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout — revokes refresh token and clears cookies' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Logged out' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const request = req as Request;
    const response = res as Response;
    const refreshToken = request.cookies?.['refresh_token'] as
      | string
      | undefined;
    if (refreshToken) {
      await this.send(
        this.authClient.send(AUTH_PATTERNS.LOGOUT, { refreshToken })
      );
    }
    this.clearTokenCookies(response);
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate token pair using refresh_token cookie' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'New access_token and refresh_token cookies set' })
  @ApiResponse({ status: 401, description: 'Refresh token missing, expired, or revoked' })
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const request = req as Request;
    const response = res as Response;
    const refreshToken = request.cookies?.['refresh_token'] as
      | string
      | undefined;
    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.REFRESH, { refreshToken })
    );
    this.setTokenCookies(response, tokens);
    return { message: 'Tokens refreshed' };
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email from link — sets cookies and redirects to client' })
  @ApiQuery({ name: 'token', description: 'Email verification token from the link' })
  @ApiResponse({ status: 302, description: 'Redirects to /auth/email-verified with auth cookies' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(
    @Query('token') token: string,
    @Res() res: any
  ) {
    const response = res as Response;
    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.VERIFY_EMAIL, { token })
    );
    this.setTokenCookies(response, tokens);
    const clientUrl = this.config.get('CLIENT_URL', { infer: true })!;
    response.redirect(`${clientUrl}/auth/email-verified`);
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiResponse({ status: 201, description: 'Verification email sent' })
  @ApiResponse({ status: 400, description: 'Account already verified' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 429, description: 'Resend cooldown active (60s)' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.send(
      this.authClient.send(AUTH_PATTERNS.RESEND_VERIFICATION, {
        email: dto.email,
      })
    );
    return { message: 'Verification email sent' };
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 201, description: 'Reset link sent if email is registered (always returns success to prevent enumeration)' })
  @ApiResponse({ status: 429, description: 'Reset cooldown active (60s)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.send(
      this.authClient.send(AUTH_PATTERNS.FORGOT_PASSWORD, { email: dto.email })
    );
    // Always return success to prevent email enumeration
    return {
      message: 'If this email is registered, a reset link has been sent',
    };
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiResponse({ status: 201, description: 'Password reset — all sessions revoked' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.send(
      this.authClient.send(AUTH_PATTERNS.RESET_PASSWORD, {
        token: dto.token,
        newPassword: dto.newPassword,
      })
    );
    return { message: 'Password reset successfully' };
  }

  // ── GitHub OAuth ──────────────────────────────────────────────────

  @Get('github')
  @UseGuards(GithubGuard)
  @ApiExcludeEndpoint()
  githubAuth() {
    // Passport redirects to GitHub — no body needed
  }

  @Get('github/callback')
  @UseGuards(GithubGuard)
  @ApiExcludeEndpoint()
  githubCallback(
    @Req() req: Request & { user: TokenPair },
    @Res() res: Response
  ) {
    this.setTokenCookies(res, req.user);
    res.redirect(this.config.get('CLIENT_URL', { infer: true })!);
  }

  // ── Yandex OAuth ──────────────────────────────────────────────────

  @Get('yandex')
  @UseGuards(YandexGuard)
  @ApiExcludeEndpoint()
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  yandexAuth() {}

  @Get('yandex/callback')
  @UseGuards(YandexGuard)
  @ApiExcludeEndpoint()
  yandexCallback(
    @Req() req: Request & { user: TokenPair },
    @Res() res: Response
  ) {
    this.setTokenCookies(res, req.user);
    res.redirect(this.config.get('CLIENT_URL', { infer: true })!);
  }

  // ── Google OAuth ──────────────────────────────────────────────────

  @Get('google')
  @UseGuards(GoogleGuard)
  @ApiExcludeEndpoint()
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleGuard)
  @ApiExcludeEndpoint()
  googleCallback(
    @Req() req: Request & { user: TokenPair },
    @Res() res: Response
  ) {
    this.setTokenCookies(res, req.user);
    res.redirect(this.config.get('CLIENT_URL', { infer: true })!);
  }

  private setTokenCookies(res: Response, tokens: TokenPair): void {
    const secure =
      this.config.get('NODE_ENV', { infer: true }) === 'production';
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge:
        this.config.get('JWT_ACCESS_TOKEN_EXPIRES', { infer: true })! * 1000,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge:
        this.config.get('JWT_REFRESH_TOKEN_EXPIRES', { infer: true })! * 1000,
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
        error.statusCode ?? 500
      );
    }
  }
}
