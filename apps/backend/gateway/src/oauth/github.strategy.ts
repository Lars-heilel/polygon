import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { AUTH_CLIENT_TOKEN, AUTH_PATTERNS, ConfigService } from '@org/core';
import type { TokenPair } from '@org/auth';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
    config: ConfigService,
  ) {
    super({
      clientID: config.githubClientId ?? '',
      clientSecret: config.githubClientSecret ?? '',
      callbackURL: `${config.appUrl}/api/auth/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<TokenPair> {
    const email =
      profile.emails?.[0]?.value ??
      `${profile.id}@github.noemail`;

    return lastValueFrom(
      this.authClient.send<TokenPair>(AUTH_PATTERNS.OAUTH_LOGIN, {
        provider: 'github',
        providerId: profile.id,
        email,
        name: profile.displayName || profile.username || email,
      }),
    );
  }
}
