import { Module } from '@nestjs/common';
import { OrgChatModule } from '@org/chat';

@Module({
  imports: [OrgChatModule],
})
export class ChatModule {}
