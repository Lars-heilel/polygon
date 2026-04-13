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
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBody,
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ForgotPasswordDto,
  GithubGuard,
  GoogleGuard,
  LocalGuard,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  YandexGuard,
} from '@org/auth';
import { type CredentialsPayload, type TokenPair, loginSchema } from '@org/common';
import { AUTH_CLIENT_TOKEN, AUTH_PATTERNS, type Env } from '@org/core';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import { Observable, lastValueFrom } from 'rxjs';

@ApiTags('auth')
@Controller('auth')
export class AuthGatewayController {
  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
    private readonly config: ConfigService<Env, true>,
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
  @UsePipes(new ZodValidationPipe(loginSchema))
  @UseGuards(LocalGuard)
  @ApiBody({ type: LoginDto, description: 'User login credentials' })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 201,
    description: 'Logged in — sets access_token and refresh_token cookies',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials or email not verified' })
  @ApiResponse({ status: 429, description: 'Too many failed attempts' })
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const credentials = req.user as CredentialsPayload;
    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.LOGIN, { id: credentials.id }),
    );
    this.setTokenCookies(res, tokens);
    return { message: 'Logged in successfully' };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout — revokes refresh token and clears cookies' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Logged out' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    if (refreshToken) {
      await this.send(this.authClient.send(AUTH_PATTERNS.LOGOUT, { refreshToken }));
    }
    this.clearTokenCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate token pair using refresh_token cookie' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'New access_token and refresh_token cookies set' })
  @ApiResponse({ status: 401, description: 'Refresh token missing, expired, or revoked' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.REFRESH, { refreshToken }),
    );
    this.setTokenCookies(res, tokens);
    return { message: 'Tokens refreshed' };
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email from link — sets cookies and redirects to client' })
  @ApiQuery({ name: 'token', description: 'Email verification token from the link' })
  @ApiResponse({ status: 302, description: 'Redirects to /auth/email-verified with auth cookies' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.VERIFY_EMAIL, { token }),
    );
    this.setTokenCookies(res, tokens);
    const clientUrl = this.config.getOrThrow('CLIENT_URL', { infer: true });
    res.redirect(`${clientUrl}/auth/email-verified`);
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
      }),
    );
    return { message: 'Verification email sent' };
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({
    status: 201,
    description:
      'Reset link sent if email is registered (always returns success to prevent enumeration)',
  })
  @ApiResponse({ status: 429, description: 'Reset cooldown active (60s)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.send(this.authClient.send(AUTH_PATTERNS.FORGOT_PASSWORD, { email: dto.email }));
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
      }),
    );
    return { message: 'Password reset successfully' };
  }

  // ── GitHub OAuth ──────────────────────────────────────────────────

  @Get('github')
  @UseGuards(GithubGuard)
  @ApiExcludeEndpoint()
  githubAuth() {
    // Passport redirects
  }

  @Get('github/callback')
  @UseGuards(GithubGuard)
  @ApiExcludeEndpoint()
  githubCallback(@Req() req: Request & { user: TokenPair }, @Res() res: Response) {
    this.setTokenCookies(res, req.user);
    const clientUrl = this.config.getOrThrow('CLIENT_URL', { infer: true });
    res.redirect(clientUrl);
  }

  // ── Yandex OAuth ──────────────────────────────────────────────────

  @Get('yandex')
  @UseGuards(YandexGuard)
  @ApiExcludeEndpoint()
  yandexAuth() {
    // Passport redirects
  }

  @Get('yandex/callback')
  @UseGuards(YandexGuard)
  @ApiExcludeEndpoint()
  yandexCallback(@Req() req: Request & { user: TokenPair }, @Res() res: Response) {
    this.setTokenCookies(res, req.user);
    const clientUrl = this.config.getOrThrow('CLIENT_URL', { infer: true });
    res.redirect(clientUrl);
  }

  // ── Google OAuth ──────────────────────────────────────────────────

  @Get('google')
  @UseGuards(GoogleGuard)
  @ApiExcludeEndpoint()
  googleAuth() {
    // Passport redirects
  }

  @Get('google/callback')
  @UseGuards(GoogleGuard)
  @ApiExcludeEndpoint()
  googleCallback(@Req() req: Request & { user: TokenPair }, @Res() res: Response) {
    this.setTokenCookies(res, req.user);
    const clientUrl = this.config.getOrThrow('CLIENT_URL', { infer: true });
    res.redirect(clientUrl);
  }

  private setTokenCookies(res: Response, tokens: TokenPair): void {
    const secure = this.config.getOrThrow('NODE_ENV', { infer: true }) === 'production';
    const accessMaxAge = this.config.getOrThrow('JWT_ACCESS_TOKEN_EXPIRES', { infer: true });
    const refreshMaxAge = this.config.getOrThrow('JWT_REFRESH_TOKEN_EXPIRES', { infer: true });

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: Number(accessMaxAge) * 1000,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: Number(refreshMaxAge) * 1000,
    });
  }

  private clearTokenCookies(res: Response): void {
    const secure = this.config.getOrThrow('NODE_ENV', { infer: true }) === 'production';
    const opts = { httpOnly: true, sameSite: 'strict' as const, secure };
    res.clearCookie('access_token', opts);
    res.clearCookie('refresh_token', opts);
  }

  private async send<T>(observable: Observable<T>): Promise<T> {
    try {
      return await lastValueFrom(observable);
    } catch (err) {
      const error = err as { statusCode?: number; message?: string };
      throw new HttpException(error.message ?? 'Internal server error', error.statusCode ?? 500);
    }
  }
}
