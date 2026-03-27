import { Module } from '@nestjs/common';
import { OrgChatModule } from '@org/chat';
import { HealthModule, LoggerModule } from '@org/core';

@Module({
  imports: [OrgChatModule, LoggerModule, HealthModule],
})
export class ChatModule {}
