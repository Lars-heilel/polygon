import { Module } from '@nestjs/common';
import { OrgChatModule } from '@org/chat';
import { ObservabilityModule, SERVICE_NAMES } from '@org/core';

@Module({
  imports: [ObservabilityModule.forService(SERVICE_NAMES.chat), OrgChatModule],
})
export class ChatModule {}
