import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { AUTH_CLIENT_TOKEN, AUTH_PATTERNS } from '@org/core';
import type { CredentialsPayload } from '@org/common';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
  ) {
    super({ usernameField: 'email' });
  }

  validate(email: string, password: string): Promise<CredentialsPayload> {
    return lastValueFrom(
      this.authClient.send<CredentialsPayload>(AUTH_PATTERNS.VALIDATE_CREDENTIALS, { email, password }),
    );
  }
}
