import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientsModule,
  Transport,
  type RmqOptions,
} from '@nestjs/microservices';
import {
  AUTH_PRISMA_REPOSITORY_TOKEN,
  AUTH_SERVICE_TOKEN,
  CoreConfigModule,
  CoreEncryptionModule,
  CoreRedisModule,
  CoreTokenModule,
  NOTIFICATION_CLIENT_TOKEN,
  NOTIFICATION_QUEUE,
  USER_CLIENT_TOKEN,
  USER_QUEUE,
  VERIFICATION_SERVICE_TOKEN,
  type Env,
} from '@org/core';
import { PrismaService } from '../database/prisma/prisma.service';
import { AuthPrismaRepository } from '../database/repository/auth.prisma.repo';
import { AuthService } from '../services/auth.service';
import { VerificationService } from '../services/verification.service';
import { AuthController } from '../controllers/auth.controller';

const rmqClient = (name: string, queue: string) => ({
  name,
  imports: [CoreConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env>): RmqOptions => ({
    transport: Transport.RMQ,
    options: {
      urls: [
        `amqp://${config.get('RABBITMQ_USER', { infer: true })}:${config.get(
          'RABBITMQ_PASSWORD',
          { infer: true }
        )}@${config.get('RABBITMQ_HOST', { infer: true })}:${config.get(
          'RABBITMQ_PORT',
          { infer: true }
        )}`,
      ],
      queue,
      queueOptions: { durable: true },
    },
  }),
});

@Module({
  imports: [
    CoreConfigModule,
    CoreEncryptionModule,
    CoreTokenModule,
    CoreRedisModule,
    ClientsModule.registerAsync([
      rmqClient(USER_CLIENT_TOKEN, USER_QUEUE),
      rmqClient(NOTIFICATION_CLIENT_TOKEN, NOTIFICATION_QUEUE),
    ]),
  ],
  controllers: [AuthController],
  providers: [
    PrismaService,
    { provide: AUTH_PRISMA_REPOSITORY_TOKEN, useClass: AuthPrismaRepository },
    { provide: VERIFICATION_SERVICE_TOKEN, useClass: VerificationService },
    { provide: AUTH_SERVICE_TOKEN, useClass: AuthService },
  ],
  exports: [PrismaService],
})
export class OrgAuthModule {}
