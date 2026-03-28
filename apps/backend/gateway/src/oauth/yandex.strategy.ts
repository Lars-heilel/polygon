import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-yandex';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { AUTH_CLIENT_TOKEN, AUTH_PATTERNS, ConfigService } from '@org/core';
import type { TokenPair } from '@org/auth';

// passport-yandex does not ship its own typings
interface YandexProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string }>;
}

@Injectable()
export class YandexStrategy extends PassportStrategy(Strategy, 'yandex') {
  constructor(
    @Inject(AUTH_CLIENT_TOKEN) private readonly authClient: ClientProxy,
    config: ConfigService,
  ) {
    super({
      clientID: config.yandexClientId ?? '',
      clientSecret: config.yandexClientSecret ?? '',
      callbackURL: `${config.appUrl}/api/auth/yandex/callback`,
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: YandexProfile,
  ): Promise<TokenPair> {
    const email =
      profile.emails?.[0]?.value ?? `${profile.id}@yandex.noemail`;

    return lastValueFrom(
      this.authClient.send<TokenPair>(AUTH_PATTERNS.OAUTH_LOGIN, {
        provider: 'yandex',
        providerId: profile.id,
        email,
        name: profile.displayName || email,
      }),
    );
  }
}
