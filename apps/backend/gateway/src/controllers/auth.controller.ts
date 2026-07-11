import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Logger,
  Param,
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
  ResetPasswordDto,
  SessionGuard,
  SessionResponse,
  YandexGuard,
} from '@org/auth';
import { LoginDto, RegisterDto, ResendVerificationDto } from '@org/auth';
import { type CredentialsPayload, type TokenPair } from '@org/common';
import {
  AUTH_CLIENT_TOKEN,
  AUTH_PATTERNS,
  ActiveAccountGuard,
  type ClientMetadata,
  type Env,
  GetClientMetadata,
  type JwtPayload,
} from '@org/core';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import { Observable, lastValueFrom } from 'rxjs';

@ApiTags('auth')
@Controller('auth')
export class AuthGatewayController {
  private readonly logger = new Logger(AuthGatewayController.name);

  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('register')
  @UsePipes(new ZodValidationPipe(RegisterDto))
  @ApiOperation({ summary: 'Register a new user with email and password' })
  @ApiResponse({ status: 201, description: 'Registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async register(@Body() dto: RegisterDto, @GetClientMetadata() metadata: ClientMetadata) {
    this.logger.log('Processing registration request');
    this.logger.debug({ hasEmail: !!dto.email, metadata }, 'Registration request context');

    await this.send(this.authClient.send(AUTH_PATTERNS.REGISTER, dto));

    this.logger.log('Successfully processed registration request');
    return { message: 'Registered successfully' };
  }

  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginDto))
  @UseGuards(LocalGuard)
  @ApiBody({ type: LoginDto, description: 'User login credentials' })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 201,
    description: 'Logged in — sets access_token and refresh_token cookies',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials or email not verified' })
  @ApiResponse({ status: 429, description: 'Too many failed attempts' })
  async login(
    @Body() _dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @GetClientMetadata() metadata: ClientMetadata,
  ) {
    const credentials = req.user as CredentialsPayload;
    this.logger.log(`Processing login for credentials ID: ${credentials.id}`);
    this.logger.debug({ credentials, metadata }, 'Login credentials and client metadata state');

    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.LOGIN, {
        id: credentials.id,
        clientMetadata: metadata,
      }),
    );

    this.setTokenCookies(res, tokens);
    this.logger.log(`Login sequence completed for credentials ID: ${credentials.id}`);

    return { message: 'Logged in successfully' };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout — revokes refresh token and clears cookies' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Logged out' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.logger.log('Processing logout request');
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;

    if (refreshToken) {
      this.logger.verbose(
        'Refresh token cookie detected, initiating microservice session revocation',
      );
      await this.send(this.authClient.send(AUTH_PATTERNS.LOGOUT, { refreshToken }));
    } else {
      this.logger.warn('Logout requested but no refresh_token cookie was provided');
    }

    this.clearTokenCookies(res);
    this.logger.log('Logout sequence completed');
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate token pair using refresh_token cookie' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'New access_token and refresh_token cookies set' })
  @ApiResponse({ status: 401, description: 'Refresh token missing, expired, or revoked' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.logger.log('Processing token refresh rotation');
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;

    if (!refreshToken) {
      this.logger.warn('Token rotation aborted: refresh_token cookie is missing');
    }
    this.logger.debug({ hasToken: !!refreshToken }, 'Refresh request state');

    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.REFRESH, { refreshToken }),
    );

    this.setTokenCookies(res, tokens);
    this.logger.log('Token rotation completed');
    return { message: 'Tokens refreshed' };
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email from link — sets cookies and redirects to client' })
  @ApiQuery({ name: 'token', description: 'Email verification token from the link' })
  @ApiResponse({ status: 302, description: 'Redirects to /auth/email-verified with auth cookies' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(
    @Query('token') token: string,
    @GetClientMetadata() metadata: ClientMetadata,
    @Res() res: Response,
  ) {
    this.logger.log('Processing email verification request');
    this.logger.debug({ hasToken: !!token, metadata }, 'Verify email state and client metadata');

    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.VERIFY_EMAIL, {
        token,
        clientMetadata: metadata,
      }),
    );

    this.setTokenCookies(res, tokens);

    const clientUrl = this.config.getOrThrow('CLIENT_URL', { infer: true });
    this.logger.log(`Email verified. Redirecting client to: ${clientUrl}/auth/email-verified`);
    res.redirect(`${clientUrl}/auth/email-verified`);
  }

  @Post('resend-verification')
  @UsePipes(new ZodValidationPipe(ResendVerificationDto))
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiResponse({ status: 201, description: 'Verification email sent' })
  @ApiResponse({ status: 400, description: 'Account already verified' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 429, description: 'Resend cooldown active (60s)' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    this.logger.log('Processing resend verification request');
    this.logger.debug({ hasEmail: !!dto.email }, 'Resend payload state');

    await this.send(
      this.authClient.send(AUTH_PATTERNS.RESEND_VERIFICATION, {
        email: dto.email,
      }),
    );

    this.logger.log('Verification link successfully resent');
    return { message: 'Verification email sent' };
  }

  @Post('forgot-password')
  @UsePipes(new ZodValidationPipe(ForgotPasswordDto))
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({
    status: 201,
    description:
      'Reset link sent if email is registered (always returns success to prevent enumeration)',
  })
  @ApiResponse({ status: 429, description: 'Reset cooldown active (60s)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    this.logger.log('Processing forgot-password request');
    this.logger.debug({ hasEmail: !!dto.email }, 'Forgot password request payload');

    await this.send(this.authClient.send(AUTH_PATTERNS.FORGOT_PASSWORD, { email: dto.email }));

    this.logger.log('Processed forgot-password routine');
    return {
      message: 'If this email is registered, a reset link has been sent',
    };
  }

  @Post('reset-password')
  @UsePipes(new ZodValidationPipe(ResetPasswordDto))
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiResponse({ status: 201, description: 'Password reset — all sessions revoked' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    this.logger.log('Processing final password-reset step');
    this.logger.debug({ hasToken: !!dto.token }, 'Reset password token parameter context');

    await this.send(
      this.authClient.send(AUTH_PATTERNS.RESET_PASSWORD, {
        token: dto.token,
        newPassword: dto.newPassword,
      }),
    );

    this.logger.log('Password successfully reset across all microservices');
    return { message: 'Password reset successfully' };
  }

  //! ── GitHub OAuth ──────────────────────────────────────────────────

  @Get('github')
  @UseGuards(GithubGuard)
  @ApiExcludeEndpoint()
  githubAuth() {
    this.logger.verbose('Redirecting user context to GitHub OAuth provider');
  }

  @Get('github/callback')
  @UseGuards(GithubGuard)
  @ApiExcludeEndpoint()
  githubCallback(
    @Req() req: Request & { user: TokenPair },
    @GetClientMetadata() metadata: ClientMetadata,
    @Res() res: Response,
  ) {
    this.logger.log('GitHub OAuth callback route triggered');
    this.logger.debug({ user: req.user, metadata }, 'GitHub callback context and client metadata');

    this.setTokenCookies(res, req.user);
    const clientUrl = this.config.getOrThrow('CLIENT_URL', { infer: true });

    this.logger.log(`GitHub authenticating completed. Redirecting to client: ${clientUrl}`);
    res.redirect(clientUrl);
  }

  //! ── Yandex OAuth ──────────────────────────────────────────────────

  @Get('yandex')
  @UseGuards(YandexGuard)
  @ApiExcludeEndpoint()
  yandexAuth() {
    this.logger.verbose('Redirecting user context to Yandex OAuth provider');
  }

  @Get('yandex/callback')
  @UseGuards(YandexGuard)
  @ApiExcludeEndpoint()
  yandexCallback(
    @Req() req: Request & { user: TokenPair },
    @GetClientMetadata() metadata: ClientMetadata,
    @Res() res: Response,
  ) {
    this.logger.log('Yandex OAuth callback route triggered');
    this.logger.debug({ user: req.user, metadata }, 'Yandex callback context and client metadata');

    this.setTokenCookies(res, req.user);
    const clientUrl = this.config.getOrThrow('CLIENT_URL', { infer: true });

    this.logger.log(`Yandex authenticating completed. Redirecting to client: ${clientUrl}`);
    res.redirect(clientUrl);
  }

  //! ── Google OAuth ──────────────────────────────────────────────────

  @Get('google')
  @UseGuards(GoogleGuard)
  @ApiExcludeEndpoint()
  googleAuth() {
    this.logger.verbose('Redirecting user context to Google OAuth provider');
  }

  @Get('google/callback')
  @UseGuards(GoogleGuard)
  @ApiExcludeEndpoint()
  googleCallback(
    @Req() req: Request & { user: TokenPair },
    @GetClientMetadata() metadata: ClientMetadata,
    @Res() res: Response,
  ) {
    this.logger.log('Google OAuth callback route triggered');
    this.logger.debug({ user: req.user, metadata }, 'Google callback context and client metadata');

    this.setTokenCookies(res, req.user);
    const clientUrl = this.config.getOrThrow('CLIENT_URL', { infer: true });

    this.logger.log(`Google authenticating completed. Redirecting to client: ${clientUrl}`);
    res.redirect(clientUrl);
  }

  @Get('sessions')
  @UseGuards(SessionGuard, ActiveAccountGuard)
  @ApiOperation({ summary: 'List active sessions for current user' })
  @ApiCookieAuth('access_token')
  async listSessions(@Req() req: Request): Promise<SessionResponse[]> {
    const jwtPayload = req.user as JwtPayload;
    this.logger.log(`Retrieving session directory for user sub: ${jwtPayload.sub}`);
    this.logger.debug({ jwtPayload }, 'Active sessions fetch JWT token state');

    const sessions = await this.send<SessionResponse[]>(
      this.authClient.send(AUTH_PATTERNS.LIST_SESSIONS, {
        credentialsId: jwtPayload.sub,
        currentSessionId: jwtPayload.sessionId,
      }),
    );

    this.logger.verbose({ sessions }, 'Sessions returned from authorization microservice');
    return sessions;
  }

  @Delete('sessions/:id')
  @UseGuards(SessionGuard, ActiveAccountGuard)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiCookieAuth('access_token')
  async revokeSession(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const jwtPayload = req.user as JwtPayload;
    this.logger.log(`Revocation request for session ${id} initiated by user: ${jwtPayload.sub}`);
    this.logger.debug({ targetSessionId: id, jwtPayload }, 'Session revocation details context');

    await this.send(
      this.authClient.send(AUTH_PATTERNS.REVOKE_SESSION, {
        sessionId: id,
        credentialsId: jwtPayload.sub,
      }),
    );

    if (id === jwtPayload.sessionId) {
      this.logger.warn(`Current active session (${id}) revoked. Token cookies are being cleared.`);
      this.clearTokenCookies(res);
    }

    this.logger.log(`Session ${id} successfully revoked`);
    return { message: 'Session revoked' };
  }

  @Delete('sessions')
  @UseGuards(SessionGuard, ActiveAccountGuard)
  @ApiOperation({ summary: 'Revoke all sessions' })
  @ApiCookieAuth('access_token')
  async revokeAllSessions(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const jwtPayload = req.user as JwtPayload;
    this.logger.log(`Full account session flush requested by user: ${jwtPayload.sub}`);
    this.logger.debug({ jwtPayload }, 'All sessions revocation JWT payload context');

    await this.send(
      this.authClient.send(AUTH_PATTERNS.REVOKE_ALL_SESSIONS, {
        credentialsId: jwtPayload.sub,
      }),
    );

    this.clearTokenCookies(res);
    this.logger.log('All active sessions invalidated and cookies flushed');
    return { message: 'All sessions revoked' };
  }

  private setTokenCookies(res: Response, tokens: TokenPair): void {
    const secure = this.config.getOrThrow('NODE_ENV', { infer: true }) === 'production';
    const accessMaxAge = this.config.getOrThrow('JWT_ACCESS_TOKEN_EXPIRES', { infer: true });
    const refreshMaxAge = this.config.getOrThrow('JWT_REFRESH_TOKEN_EXPIRES', { infer: true });

    this.logger.verbose(
      { secure, accessMaxAge, refreshMaxAge },
      'Applying secure token parameters to response cookies',
    );

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
    this.logger.verbose({ opts }, 'Applying clear token parameters to response cookies');
    res.clearCookie('access_token', opts);
    res.clearCookie('refresh_token', opts);
  }

  private async send<T>(observable: Observable<T>): Promise<T> {
    try {
      return await lastValueFrom(observable);
    } catch (err) {
      const errObj = Object.getOwnPropertyNames(err).reduce(
        (acc, k) => ({ ...acc, [k]: (err as Record<string, unknown>)[k] }),
        {} as Record<string, unknown>,
      );
      this.logger.error({ err: errObj }, 'RPC call failed');
      this.logger.debug('Full RPC error dump: %o', errObj);

      const rpcErr = err as Record<string, unknown>;
      const response = rpcErr.response as Record<string, unknown> | undefined;
      const message = (rpcErr.message ?? response?.message ?? 'Internal server error') as string;
      const rawStatus = (rpcErr.statusCode ??
        rpcErr.status ??
        response?.statusCode ??
        500) as number;
      const status = typeof rawStatus === 'number' ? rawStatus : 500;

      this.logger.warn(`RPC failed [${status}]: ${message}`);
      throw new HttpException(message, status);
    }
  }
}
