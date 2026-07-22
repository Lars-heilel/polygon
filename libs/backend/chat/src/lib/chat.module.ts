import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, type RmqOptions, Transport } from '@nestjs/microservices';
import {
  CHAT_PRISMA_REPOSITORY_TOKEN,
  CHAT_SERVICE_TOKEN,
  CoreConfigModule,
  type Env,
  MEDIA_CLIENT_TOKEN,
  MEDIA_QUEUE,
} from '@org/core';

import { ChatController } from '../controllers/chat.controller';
import { PrismaService } from '../database/prisma/prisma.service';
import { ChatPrismaRepository } from '../database/repository/chat.prisma.repo';
import { ChatService } from '../services/chat.service';

const mediaClient = {
  name: MEDIA_CLIENT_TOKEN,
  imports: [CoreConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): RmqOptions => ({
    transport: Transport.RMQ,
    options: {
      urls: [config.get<string>('RABBITMQ_URL', { infer: true })],
      queue: MEDIA_QUEUE,
      queueOptions: { durable: true },
    },
  }),
};

@Module({
  imports: [CoreConfigModule, ClientsModule.registerAsync([mediaClient])],
  controllers: [ChatController],
  providers: [
    PrismaService,
    { provide: CHAT_PRISMA_REPOSITORY_TOKEN, useClass: ChatPrismaRepository },
    { provide: CHAT_SERVICE_TOKEN, useClass: ChatService },
  ],
  exports: [PrismaService],
})
export class OrgChatModule {}
