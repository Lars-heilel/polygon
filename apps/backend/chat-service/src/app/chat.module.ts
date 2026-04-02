import { Module } from '@nestjs/common';
import { OrgChatModule } from '@org/chat';
import { HealthModule, LoggerModule, MetricsModule } from '@org/core';

@Module({
  imports: [OrgChatModule, LoggerModule, HealthModule, MetricsModule],
})
export class ChatModule {}
