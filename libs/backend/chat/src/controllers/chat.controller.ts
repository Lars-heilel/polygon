import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { Chat, Message, MessagePage } from '@org/common';
import { CHAT_PATTERNS, CHAT_SERVICE_TOKEN } from '@org/core';

import type {
  ChatWithPreview,
  ForwardMessagesData,
  IChatController,
  IChatService,
} from '../interfaces/chat.interface';

@Controller()
export class ChatController implements IChatController {
  constructor(@Inject(CHAT_SERVICE_TOKEN) private readonly chatService: IChatService) {}

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
    @Payload()
    payload: {
      chatId: string;
      userId: string;
      cursor?: string;
      take?: number;
    },
  ): Promise<MessagePage> {
    return this.chatService.getMessages(
      payload.chatId,
      payload.userId,
      payload.cursor,
      payload.take ?? 50,
    );
  }

  @MessagePattern(CHAT_PATTERNS.SEND_MESSAGE)
  sendMessage(
    @Payload()
    payload: {
      chatId: string;
      senderId: string;
      type: string;
      text?: string | null;
      fileId?: string | null;
      fileBucket?: string | null;
      fileKey?: string | null;
      fileName?: string | null;
      fileSize?: number | null;
      fileMime?: string | null;
      fileCategory?: string | null;
    },
  ): Promise<Message> {
    return this.chatService.sendMessage(payload.chatId, payload.senderId, {
      type: payload.type,
      text: payload.text,
      fileId: payload.fileId,
      fileBucket: payload.fileBucket,
      fileKey: payload.fileKey,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      fileMime: payload.fileMime,
      fileCategory: payload.fileCategory,
    });
  }

  @MessagePattern(CHAT_PATTERNS.FORWARD_MESSAGES)
  forwardMessages(@Payload() payload: ForwardMessagesData): Promise<Message[]> {
    return this.chatService.forwardMessages(payload);
  }

  @MessagePattern(CHAT_PATTERNS.CHECK_MEMBERSHIP)
  checkMembership(@Payload() payload: { chatId: string; userId: string }): Promise<boolean> {
    return this.chatService.checkMembership(payload.chatId, payload.userId);
  }
}
