import { Module } from '@nestjs/common';
import { CHAT_PRISMA_REPOSITORY_TOKEN, CHAT_SERVICE_TOKEN, CoreConfigModule } from '@org/core';

import { ChatController } from '../controllers/chat.controller';
import { PrismaService } from '../database/prisma/prisma.service';
import { ChatPrismaRepository } from '../database/repository/chat.prisma.repo';
import { ChatService } from '../services/chat.service';

@Module({
  imports: [CoreConfigModule],
  controllers: [ChatController],
  providers: [
    PrismaService,
    { provide: CHAT_PRISMA_REPOSITORY_TOKEN, useClass: ChatPrismaRepository },
    { provide: CHAT_SERVICE_TOKEN, useClass: ChatService },
  ],
  exports: [PrismaService],
})
export class OrgChatModule {}
