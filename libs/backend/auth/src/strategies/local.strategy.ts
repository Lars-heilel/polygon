import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PassportStrategy } from '@nestjs/passport';
import type { CredentialsPayload } from '@org/common';
import { AUTH_CLIENT_TOKEN, AUTH_PATTERNS } from '@org/core';
import { Strategy } from 'passport-local';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(@Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<CredentialsPayload> {
    try {
      return await lastValueFrom(
        this.authClient.send<CredentialsPayload>(AUTH_PATTERNS.VALIDATE_CREDENTIALS, {
          email,
          password,
        }),
      );
    } catch (err) {
      const error = err as { statusCode?: number; message?: string };
      throw new HttpException(error.message ?? 'Invalid credentials', error.statusCode ?? 401);
    }
  }
}
