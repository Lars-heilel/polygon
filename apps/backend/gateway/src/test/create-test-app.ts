import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GithubStrategy, GoogleStrategy, LocalStrategy, YandexStrategy } from '@org/auth';
import {
  AUTH_CLIENT_TOKEN,
  CHAT_CLIENT_TOKEN,
  CoreConfigModule,
  CoreTokenModule,
  JwtGuard,
  SEARCH_CLIENT_TOKEN,
  USER_CLIENT_TOKEN,
} from '@org/core';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import passport from 'passport';
import { of } from 'rxjs';

import { AuthGatewayController } from '../controllers/auth.controller';
import { UserGatewayController } from '../controllers/user.controller';

/** Creates a lightweight NestJS test app with mocked microservice clients. */
export async function createTestApp(): Promise<{
  app: INestApplication;
  authClient: Record<string, jest.Mock>;
}> {
  const authClient = {
    send: jest.fn().mockReturnValue(of({})),
    emit: jest.fn(),
  };

  const userClient = {
    send: jest.fn().mockReturnValue(of({})),
    emit: jest.fn(),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [CoreConfigModule, CoreTokenModule],
    controllers: [AuthGatewayController, UserGatewayController],
    providers: [
      JwtGuard,
      LocalStrategy,
      GithubStrategy,
      YandexStrategy,
      GoogleStrategy,
      { provide: AUTH_CLIENT_TOKEN, useValue: authClient },
      { provide: USER_CLIENT_TOKEN, useValue: userClient },
      {
        provide: CHAT_CLIENT_TOKEN,
        useValue: { send: jest.fn().mockReturnValue(of({})), emit: jest.fn() },
      },
      {
        provide: SEARCH_CLIENT_TOKEN,
        useValue: { send: jest.fn().mockReturnValue(of({})), emit: jest.fn() },
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.use(passport.initialize());
  app.useGlobalPipes(new ZodValidationPipe());
  app.setGlobalPrefix('api');
  await app.init();

  return { app, authClient };
}
