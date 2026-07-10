import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, type RmqOptions, Transport } from '@nestjs/microservices';
import {
  AUTH_CACHE_REPOSITORY_TOKEN,
  AUTH_PRISMA_REPOSITORY_TOKEN,
  AUTH_SERVICE_TOKEN,
  BAN_CACHE_REPOSITORY_TOKEN,
  CoreConfigModule,
  CoreEncryptionModule,
  CoreRedisModule,
  CoreTokenModule,
  type Env,
  NOTIFICATION_CLIENT_TOKEN,
  NOTIFICATION_QUEUE,
  SEARCH_CLIENT_TOKEN,
  SEARCH_QUEUE,
  SESSION_CACHE_REPOSITORY_TOKEN,
  USER_CLIENT_TOKEN,
  USER_QUEUE,
  VERIFICATION_SERVICE_TOKEN,
} from '@org/core';

import { AuthRedisCacheRepository } from '../cache/auth.redis.repo';
import {
  ADMIN_BAN_CLOCK_TOKEN,
  ADMIN_LOCK_TIMING_TOKEN,
  AdminBanService,
} from '../admin/admin-ban.service';
import { BanRedisRepository } from '../cache/ban.redis.repo';
import { SessionRedisRepository } from '../cache/session.redis.repo';
import { AuthController } from '../controllers/auth.controller';
import { PrismaService } from '../database/prisma/prisma.service';
import { AuthPrismaRepository } from '../database/repository/auth.prisma.repo';
import { SessionGuard } from '../guards/session.guard';
import { AuthService } from '../services/auth.service';
import { CleanupService } from '../services/cleanup.service';
import { VerificationService } from '../services/verification.service';

const rmqClient = (name: string, queue: string) => ({
  name,
  imports: [CoreConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): RmqOptions => ({
    transport: Transport.RMQ,
    options: {
      urls: [config.get<string>('RABBITMQ_URL', { infer: true })],
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
      rmqClient(SEARCH_CLIENT_TOKEN, SEARCH_QUEUE),
    ]),
  ],
  controllers: [AuthController],
  providers: [
    PrismaService,
    { provide: AUTH_PRISMA_REPOSITORY_TOKEN, useClass: AuthPrismaRepository },
    { provide: AUTH_CACHE_REPOSITORY_TOKEN, useClass: AuthRedisCacheRepository },
    { provide: SESSION_CACHE_REPOSITORY_TOKEN, useClass: SessionRedisRepository },
    { provide: BAN_CACHE_REPOSITORY_TOKEN, useClass: BanRedisRepository },
    { provide: ADMIN_BAN_CLOCK_TOKEN, useValue: () => new Date() },
    // Short operations renew every 10s; the 30s lease bounds crash recovery.
    { provide: ADMIN_LOCK_TIMING_TOKEN, useValue: { leaseMs: 30_000, renewIntervalMs: 10_000 } },
    AdminBanService,
    { provide: VERIFICATION_SERVICE_TOKEN, useClass: VerificationService },
    { provide: AUTH_SERVICE_TOKEN, useClass: AuthService },
    CleanupService,
    SessionGuard,
  ],
  exports: [PrismaService, SessionGuard],
})
export class OrgAuthModule {}
