import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { PassportStrategy } from '@nestjs/passport';
import type { TokenPair } from '@org/common';
import { AUTH_CLIENT_TOKEN, AUTH_PATTERNS, type Env, extractClientMetadata } from '@org/core';
import { Profile, Strategy } from 'passport-github2';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
    config: ConfigService<Env>,
  ) {
    super({
      clientID: config.get('GITHUB_CLIENT_ID', { infer: true }) || 'not-configured',
      clientSecret: config.get('GITHUB_CLIENT_SECRET', { infer: true }) || 'not-configured',
      callbackURL: `${config.get('APP_URL', {
        infer: true,
      })}/api/auth/github/callback`,
      scope: ['user:email'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<TokenPair> {
    const email = profile.emails?.[0]?.value ?? `${profile.id}@github.noemail`;
    const clientMetadata = extractClientMetadata(req);

    return lastValueFrom(
      this.authClient.send<TokenPair>(AUTH_PATTERNS.OAUTH_LOGIN, {
        provider: 'github',
        providerId: profile.id,
        email,
        name: profile.displayName || profile.username || email,
        clientMetadata,
      }),
    );
  }
}
