import { Module } from '@nestjs/common';
import { OrgChatModule } from '@org/chat';
import { HealthModule } from '@org/core';

@Module({
  imports: [OrgChatModule, HealthModule],
})
export class ChatModule {}
