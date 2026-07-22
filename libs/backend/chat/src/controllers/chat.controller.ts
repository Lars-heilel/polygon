import { Controller, Inject, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { Chat, ChatMember, Message, MessagePage } from '@org/common';
import { CHAT_PATTERNS, CHAT_SERVICE_TOKEN } from '@org/core';

import type {
  ChatWithPreview,
  CreateMessageAttachmentData,
  CloneForwardMessagesData,
  ForwardMessagesData,
  IChatController,
  IChatService,
  MessageAttachmentAccessInput,
  PreparedForwardMessage,
} from '../interfaces/chat.interface';

@Controller()
export class ChatController implements IChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(@Inject(CHAT_SERVICE_TOKEN) private readonly chatService: IChatService) {}

  @MessagePattern(CHAT_PATTERNS.CREATE_DIRECT)
  createDirect(@Payload() payload: { userId: string; targetUserId: string }): Promise<Chat> {
    return this.chatService.createDirectChat(payload.userId, payload.targetUserId);
  }

  @MessagePattern(CHAT_PATTERNS.CREATE_SELF)
  createSelf(@Payload() payload: { userId: string }): Promise<Chat> {
    return this.chatService.createSelfChat(payload.userId);
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

  @MessagePattern(CHAT_PATTERNS.GET_MEDIA_MESSAGES)
  getMediaMessages(
    @Payload()
    payload: {
      chatId: string;
      userId: string;
      cursor?: string;
      take?: number;
      filter: 'ALL' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'LINK';
    },
  ): Promise<MessagePage> {
    return this.chatService.getMediaMessages(
      payload.chatId,
      payload.userId,
      payload.cursor,
      payload.take ?? 50,
      payload.filter,
    );
  }

  @MessagePattern(CHAT_PATTERNS.SEND_MESSAGE)
  sendMessage(
    @Payload()
    payload: {
      chatId: string;
      clientId?: string | null;
      senderId: string;
      type: string;
      text?: string | null;
      attachments?: CreateMessageAttachmentData[];
      fileId?: string | null;
      fileBucket?: string | null;
      fileKey?: string | null;
      fileName?: string | null;
      fileSize?: number | null;
      fileMime?: string | null;
      fileCategory?: string | null;
    },
  ): Promise<Message> {
    this.logger.debug({
      eventType: 'message_send_requested',
      hasChatId: !!payload.chatId,
      hasSenderId: !!payload.senderId,
      hasClientId: !!payload.clientId,
      type: payload.type,
      hasText: !!payload.text,
      hasFile: !!payload.fileId,
    });
    return this.chatService.sendMessage(payload.chatId, payload.senderId, {
      clientId: payload.clientId ?? null,
      type: payload.type,
      text: payload.text,
      attachments: payload.attachments,
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

  @MessagePattern(CHAT_PATTERNS.PREPARE_FORWARD_MESSAGES)
  prepareForwardMessages(@Payload() payload: ForwardMessagesData): Promise<PreparedForwardMessage[]> {
    return this.chatService.prepareForwardMessages!(payload);
  }

  @MessagePattern(CHAT_PATTERNS.CLONE_FORWARD_MESSAGES)
  cloneForwardMessages(@Payload() payload: CloneForwardMessagesData): Promise<Message[]> {
    return this.chatService.cloneForwardMessages!(payload);
  }

  @MessagePattern(CHAT_PATTERNS.EDIT_MESSAGE)
  editMessage(
    @Payload()
    payload: {
      chatId: string;
      messageId: string;
      userId: string;
      text: string;
    },
  ): Promise<Message> {
    return this.chatService.editMessage(payload.chatId, payload.messageId, payload.userId, payload.text);
  }

  @MessagePattern(CHAT_PATTERNS.DELETE_MESSAGE)
  deleteMessage(
    @Payload()
    payload: {
      chatId: string;
      messageId: string;
      userId: string;
      mode: 'ME' | 'EVERYONE';
    },
  ): Promise<Message | { id: string; chatId: string }> {
    return this.chatService.deleteMessage(payload.chatId, payload.messageId, payload.userId, payload.mode);
  }

  @MessagePattern(CHAT_PATTERNS.MARK_READ)
  markRead(
    @Payload() payload: { chatId: string; userId: string; messageId?: string | null },
  ): Promise<ChatMember> {
    this.logger.debug({
      eventType: 'chat_read_mark_requested',
      hasChatId: !!payload.chatId,
      hasUserId: !!payload.userId,
      hasMessageId: !!payload.messageId,
    });
    return this.chatService.markRead(payload.chatId, payload.userId, payload.messageId ?? null);
  }

  @MessagePattern(CHAT_PATTERNS.CHECK_MEMBERSHIP)
  checkMembership(@Payload() payload: { chatId: string; userId: string }): Promise<boolean> {
    return this.chatService.checkMembership(payload.chatId, payload.userId);
  }

  @MessagePattern(CHAT_PATTERNS.GET_MEMBERS)
  getMembers(@Payload() payload: { chatId: string }): Promise<{ userId: string }[]> {
    return this.chatService.getMembers(payload.chatId);
  }

  @MessagePattern(CHAT_PATTERNS.GET_MESSAGE_ATTACHMENT_FOR_ACCESS)
  getMessageAttachmentForAccess(
    @Payload() payload: MessageAttachmentAccessInput,
  ): Promise<{ mediaId: string }> {
    return this.chatService.getMessageAttachmentForAccess(payload);
  }
}
