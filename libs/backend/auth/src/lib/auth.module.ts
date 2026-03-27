import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  ConfigService,
  CoreConfigModule,
  CoreEncryptionModule,
  CoreRedisModule,
  CoreTokenModule,
  NOTIFICATION_CLIENT_TOKEN,
  NOTIFICATION_QUEUE,
  USER_CLIENT_TOKEN,
  USER_QUEUE,
} from '@org/core';
import { PrismaService } from '../database/prisma/prisma.service';
import { AuthPrismaRepository } from '../database/repository/auth.prisma.repo';
import { AuthService } from '../services/auth.service';
import { VerificationService } from '../services/verification.service';
import { AuthController } from '../controllers/auth.controller';

@Module({
  imports: [
    CoreConfigModule,
    CoreEncryptionModule,
    CoreTokenModule,
    CoreRedisModule,
    ClientsModule.registerAsync([
      {
        name: USER_CLIENT_TOKEN,
        imports: [CoreConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.rabbitmqUrl],
            queue: USER_QUEUE,
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: NOTIFICATION_CLIENT_TOKEN,
        imports: [CoreConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.rabbitmqUrl],
            queue: NOTIFICATION_QUEUE,
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [PrismaService, AuthPrismaRepository, AuthService, VerificationService],
  exports: [PrismaService],
})
export class OrgAuthModule {}
