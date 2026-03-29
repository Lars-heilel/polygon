import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CHAT_PATTERNS, CHAT_SERVICE_TOKEN } from '@org/core';
import type { Chat, Message } from '@org/common';
import type { IChatController, IChatService, ChatWithPreview } from '../interfaces/chat.interface';

@Controller()
export class ChatController implements IChatController {
  constructor(
    @Inject(CHAT_SERVICE_TOKEN) private readonly chatService: IChatService,
  ) {}

  @MessagePattern(CHAT_PATTERNS.CREATE_DIRECT)
  createDirect(@Payload() payload: { userId: string; targetUserId: string }): Promise<Chat> {
    return this.chatService.createDirectChat(payload.userId, payload.targetUserId);
  }

  @MessagePattern(CHAT_PATTERNS.GET_CHATS)
  getChats(@Payload() payload: { userId: string }): Promise<ChatWithPreview[]> {
    return this.chatService.getChats(payload.userId);
  }

  @MessagePattern(CHAT_PATTERNS.GET_MESSAGES)
  getMessages(
    @Payload() payload: { chatId: string; userId: string; skip?: number; take?: number },
  ): Promise<Message[]> {
    return this.chatService.getMessages(payload.chatId, payload.userId, payload.skip, payload.take);
  }

  @MessagePattern(CHAT_PATTERNS.SEND_MESSAGE)
  sendMessage(
    @Payload() payload: { chatId: string; senderId: string; text: string },
  ): Promise<Message> {
    return this.chatService.sendMessage(payload.chatId, payload.senderId, payload.text);
  }

  @MessagePattern(CHAT_PATTERNS.CHECK_MEMBERSHIP)
  checkMembership(@Payload() payload: { chatId: string; userId: string }): Promise<boolean> {
    return this.chatService.checkMembership(payload.chatId, payload.userId);
  }
}
