import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { AUTH_CLIENT_TOKEN, AUTH_PATTERNS, ConfigService } from '@org/core';
import type { TokenPair } from '@org/auth';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
    config: ConfigService,
  ) {
    super({
      clientID: config.googleClientId ?? '',
      clientSecret: config.googleClientSecret ?? '',
      callbackURL: `${config.appUrl}/api/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<TokenPair> {
    const email =
      profile.emails?.[0]?.value ??
      `${profile.id}@google.noemail`;

    return lastValueFrom(
      this.authClient.send<TokenPair>(AUTH_PATTERNS.OAUTH_LOGIN, {
        provider: 'google',
        providerId: profile.id,
        email,
        name: profile.displayName || email,
      }),
    );
  }
}
