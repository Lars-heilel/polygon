import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import {
  AUTH_CLIENT_TOKEN,
  CHAT_CLIENT_TOKEN,
  CoreConfigModule,
  CoreTokenModule,
  JwtGuard,
  USER_CLIENT_TOKEN,
} from '@org/core';
import { GithubStrategy, GoogleStrategy, LocalStrategy, YandexStrategy } from '@org/auth';
import { AuthGatewayController } from '../controllers/auth.controller';
import { UserGatewayController } from '../controllers/user.controller';
import { ZodValidationPipe } from 'nestjs-zod';

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
      { provide: CHAT_CLIENT_TOKEN, useValue: { send: jest.fn().mockReturnValue(of({})), emit: jest.fn() } },
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
