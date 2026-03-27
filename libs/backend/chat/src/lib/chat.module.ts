import { Module } from '@nestjs/common';
import { CoreConfigModule } from '@org/core';
import { PrismaService } from '../database/prisma/prisma.service';
import { ChatPrismaRepository } from '../database/repository/chat.prisma.repo';
import { ChatService } from '../services/chat.service';
import { ChatController } from '../controllers/chat.controller';

@Module({
  imports: [CoreConfigModule],
  controllers: [ChatController],
  providers: [PrismaService, ChatPrismaRepository, ChatService],
  exports: [PrismaService, ChatService],
})
export class OrgChatModule {}
