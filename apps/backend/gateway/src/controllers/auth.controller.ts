import {
  Body,
  Controller,
  HttpException,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { Request, Response } from 'express';
import { lastValueFrom, Observable } from 'rxjs';
import { AUTH_CLIENT_TOKEN, AUTH_PATTERNS, ConfigService } from '@org/core';
import type { TokenPair } from '@org/auth';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

@Controller('auth')
export class AuthGatewayController {
  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
    private readonly config: ConfigService,
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
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: any) {
    const response = res as Response;
    const tokens = await this.send<TokenPair>(
      this.authClient.send(AUTH_PATTERNS.LOGIN, dto),
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

  private setTokenCookies(res: Response, tokens: TokenPair): void {
    const secure = this.config.nodeEnv === 'production';
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: this.config.jwtAccessExpiresIn * 1000,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: this.config.jwtRefreshExpiresIn * 1000,
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
