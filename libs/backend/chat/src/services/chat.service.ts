import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { Chat, ChatMediaFilter, ChatMember, Message, MessagePage } from '@org/common';
import { CHAT_PRISMA_REPOSITORY_TOKEN, MEDIA_CLIENT_TOKEN, MEDIA_PATTERNS } from '@org/core';
import { lastValueFrom } from 'rxjs';

import type {
  ChatWithPreview,
  CloneForwardMessagesData,
  CloneForwardMessageInput,
  CreateMessageAttachmentData,
  CreateMessageForwardContextData,
  ForwardMessagesData,
  IChatRepository,
  IChatService,
  MessageAttachmentAccessInput,
  PreparedForwardMessage,
  SendMessageData,
} from '../interfaces/chat.interface';

function buildAttachmentInput(input: SendMessageData): CreateMessageAttachmentData[] {
  if (input.attachments?.length) return input.attachments;
  if (!input.fileId) return [];

  return [{
    mediaId: input.fileId,
    fileNameSnapshot: input.fileName ?? null,
    fileSizeSnapshot: input.fileSize ?? null,
    mimeSnapshot: input.fileMime ?? null,
    category: input.fileCategory ?? input.type ?? 'FILE',
  }];
}

@Injectable()
export class ChatService implements IChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(CHAT_PRISMA_REPOSITORY_TOKEN) private readonly repo: IChatRepository,
    @Inject(MEDIA_CLIENT_TOKEN) private readonly mediaClient?: ClientProxy,
  ) {}

  async createDirectChat(userId: string, targetUserId: string): Promise<Chat> {
    const isSelfChat = targetUserId === userId;
    const existing = isSelfChat
      ? await this.repo.findSelfChat(userId)
      : await this.repo.findDirectChatBetween(userId, targetUserId);
    if (existing) return existing;

    if (isSelfChat) {
      return this.repo.createSelfChat(userId);
    }

    const chat = await this.repo.createChat({
      type: 'DIRECT',
      name: null,
    });
    await this.repo.addChatMember({ chatId: chat.id, userId });
    await this.repo.addChatMember({ chatId: chat.id, userId: targetUserId });

    return this.repo.findChatById(chat.id).then((c) => {
      if (!c) throw new NotFoundException('Chat not found after creation');
      return c;
    });
  }

  async getChats(userId: string): Promise<ChatWithPreview[]> {
    this.logger.log({ eventType: 'chat_list_requested', hasUserId: !!userId });
    return this.repo.findChatsForUser(userId);
  }

  async createSelfChat(userId: string): Promise<Chat> {
    this.logger.log({ eventType: 'self_chat_create_requested', hasUserId: !!userId });
    return this.createDirectChat(userId, userId);
  }

  async getMessages(
    chatId: string,
    userId: string,
    cursor: string | undefined,
    take = 50,
  ): Promise<MessagePage> {
    const member = await this.repo.findChatMember(chatId, userId);
    if (!member) throw new ForbiddenException('Not a member of this chat');
    return this.repo.findMessagesByChat(chatId, cursor, take, userId);
  }

  async getMediaMessages(
    chatId: string,
    userId: string,
    cursor: string | undefined,
    take = 50,
    filter: ChatMediaFilter,
  ): Promise<MessagePage> {
    const member = await this.repo.findChatMember(chatId, userId);
    if (!member) throw new ForbiddenException('Not a member of this chat');
    return this.repo.findMediaMessagesByChat(chatId, cursor, take, filter, userId);
  }

  async getMessageAttachmentForAccess(
    input: MessageAttachmentAccessInput,
  ): Promise<{ mediaId: string }> {
    const logContext = {
      hasChatId: !!input.chatId,
      hasMessageId: !!input.messageId,
      hasAttachmentId: !!input.attachmentId,
      hasUserId: !!input.userId,
    };
    this.logger.debug({ eventType: 'message_attachment_access_requested', ...logContext });

    let member;
    try {
      member = await this.repo.findChatMember(input.chatId, input.userId);
    } catch (error) {
      this.logger.error({ eventType: 'message_attachment_access_failed', ...logContext, reason: 'membership_lookup_failed' });
      throw error;
    }

    if (!member) {
      this.logger.warn({ eventType: 'message_attachment_access_denied', ...logContext, reason: 'not_chat_member' });
      throw new ForbiddenException('Not a member of this chat');
    }

    this.logger.debug({ eventType: 'message_attachment_access_started', ...logContext });
    try {
      const attachment = await this.repo.findMessageAttachmentForAccess(input);
      if (!attachment) {
        this.logger.warn({
          eventType: 'message_attachment_access_denied',
          ...logContext,
          reason: 'attachment_not_in_message_chat',
        });
        throw new NotFoundException('Attachment not found');
      }

      this.logger.log({
        eventType: 'message_attachment_access_success',
        ...logContext,
        hasMediaId: !!attachment.mediaId,
      });
      return attachment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error({ eventType: 'message_attachment_access_failed', ...logContext, reason: 'attachment_lookup_failed' });
      throw error;
    }
  }

  async sendMessage(
    chatId: string,
    senderId: string,
    input: SendMessageData,
  ): Promise<Message> {
    this.logger.debug({
      eventType: 'message_send_requested',
      hasChatId: !!chatId,
      hasSenderId: !!senderId,
      hasClientId: !!input.clientId,
      type: input.type,
      hasText: !!input.text,
      hasFile: !!input.fileId,
    });
    const member = await this.repo.findChatMember(chatId, senderId);
    if (!member) {
      this.logger.warn({
        eventType: 'chat_membership_denied',
        hasChatId: !!chatId,
        hasUserId: !!senderId,
      });
      throw new ForbiddenException('Not a member of this chat');
    }

    const attachments = buildAttachmentInput(input);
    const message = await this.repo.createMessageWithRelations({
      chatId,
      clientId: input.clientId ?? null,
      senderId,
      type: input.type as Message['type'],
      text: input.text ?? null,
      fileId: input.fileId ?? null,
      fileBucket: input.fileBucket ?? null,
      fileKey: input.fileKey ?? null,
      fileName: input.fileName ?? null,
      fileSize: input.fileSize ?? null,
      fileMime: input.fileMime ?? null,
      fileCategory: input.fileCategory ?? null,
      attachments,
    });

    this.logger.log({
      eventType: 'message_attachment_created',
      hasMessageId: !!message.id,
      attachmentCount: attachments.length,
    });

    if (attachments.length === 0) {
      this.logger.debug({ eventType: 'media_reference_create_skipped', attachmentCount: 0 });
      return message;
    }

    const createdAttachments = message.attachments ?? [];
    if (createdAttachments.length !== attachments.length || !this.mediaClient) {
      const error = new Error('Message attachments could not be protected');
      this.logger.error({
        eventType: 'media_reference_create_failed',
        hasMessageId: !!message.id,
        attachmentCount: attachments.length,
        hasMediaClient: !!this.mediaClient,
      });
      await this.compensateFailedMessageSend(message, []);
      this.logger.error({
        eventType: 'message_send_failed',
        hasMessageId: !!message.id,
        attachmentCount: attachments.length,
      });
      throw error;
    }

    const createdReferences: CreateMessageAttachmentData[] = [];
    this.logger.debug({
      eventType: 'media_reference_create_requested',
      hasMessageId: !!message.id,
      attachmentCount: createdAttachments.length,
    });

    try {
      for (const attachment of createdAttachments) {
        this.logger.debug({ eventType: 'media_reference_create_started', hasMessageId: !!message.id });
        await lastValueFrom(this.mediaClient.send(MEDIA_PATTERNS.CREATE_REFERENCE, {
          fileId: attachment.mediaId,
          ownerType: 'MESSAGE_ATTACHMENT',
          ownerId: attachment.id,
        }));
        createdReferences.push({
          mediaId: attachment.mediaId,
          fileNameSnapshot: null,
          fileSizeSnapshot: null,
          mimeSnapshot: null,
          category: attachment.category,
        });
      }
    } catch (error) {
      this.logger.error({
        eventType: 'media_reference_create_failed',
        hasMessageId: !!message.id,
        attachmentCount: createdAttachments.length,
        createdReferenceCount: createdReferences.length,
        hasError: !!error,
      });
      await this.compensateFailedMessageSend(message, createdAttachments.slice(0, createdReferences.length));
      this.logger.error({
        eventType: 'message_send_failed',
        hasMessageId: !!message.id,
        attachmentCount: createdAttachments.length,
      });
      throw error;
    }

    this.logger.log({
      eventType: 'media_reference_created',
      hasMessageId: !!message.id,
      referenceCount: createdReferences.length,
    });
    return message;
  }

  private async compensateFailedMessageSend(
    message: Message,
    referencedAttachments: Message['attachments'],
  ): Promise<void> {
    if (this.mediaClient) {
      for (const attachment of referencedAttachments) {
        try {
          await lastValueFrom(this.mediaClient.send(MEDIA_PATTERNS.DELETE_REFERENCE, {
            fileId: attachment.mediaId,
            ownerType: 'MESSAGE_ATTACHMENT',
            ownerId: attachment.id,
          }));
        } catch (error) {
          this.logger.warn({
            eventType: 'media_reference_delete_skipped',
            hasMessageId: !!message.id,
            hasError: !!error,
          });
        }
      }
    }

    try {
      await this.repo.deleteCreatedMessage(message.id);
      this.logger.warn({ eventType: 'message_send_compensated', hasMessageId: !!message.id });
    } catch (error) {
      this.logger.error({
        eventType: 'message_send_compensation_failed',
        hasMessageId: !!message.id,
        hasError: !!error,
      });
    }
  }

  async editMessage(
    chatId: string,
    messageId: string,
    userId: string,
    text: string,
  ): Promise<Message> {
    this.logger.log({
      eventType: 'message_edit_requested',
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasUserId: !!userId,
    });
    await this.requireMember(chatId, userId);
    const message = await this.requireMessageInChat(chatId, messageId);

    if (message.senderId !== userId || message.type !== 'TEXT' || message.fileId || message.deletedAt) {
      this.logger.warn({
        eventType: 'message_edit_rejected',
        hasChatId: !!chatId,
        hasMessageId: !!messageId,
        hasUserId: !!userId,
      });
      throw new ForbiddenException('Message cannot be edited');
    }

    const updated = await this.repo.updateMessageText(messageId, text);
    this.logger.log({
      eventType: 'message_edited',
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasUserId: !!userId,
    });
    return updated;
  }

  async deleteMessage(
    chatId: string,
    messageId: string,
    userId: string,
    mode: 'ME' | 'EVERYONE',
  ): Promise<Message | { id: string; chatId: string }> {
    this.logger.log({
      eventType: 'message_delete_requested',
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasUserId: !!userId,
      mode,
    });
    await this.requireMember(chatId, userId);
    const message = await this.requireMessageInChat(chatId, messageId);

    if (mode === 'EVERYONE') {
      if (message.senderId !== userId) {
        this.logger.warn({
          eventType: 'message_delete_rejected',
          hasChatId: !!chatId,
          hasMessageId: !!messageId,
          hasUserId: !!userId,
          mode,
        });
        throw new ForbiddenException('Only the sender can delete this message for everyone');
      }

      const deleted = await this.repo.deleteMessageForEveryone(messageId, userId);
      this.logger.log({
        eventType: 'message_deleted_for_everyone',
        hasChatId: !!chatId,
        hasMessageId: !!messageId,
        hasUserId: !!userId,
      });
      return deleted;
    }

    await this.repo.hideMessageForUser(messageId, userId);
    this.logger.log({
      eventType: 'message_deleted_for_user',
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasUserId: !!userId,
    });
    return { id: messageId, chatId };
  }

  async forwardMessages(data: ForwardMessagesData): Promise<Message[]> {
    const { sourceChatId, targetChatId, messageIds, userId } = data;
    this.logger.log({
      eventType: 'message_forward_requested',
      hasSourceChatId: !!sourceChatId,
      hasTargetChatId: !!targetChatId,
      hasUserId: !!userId,
      messageCount: messageIds.length,
    });

    const isSourceMember = await this.repo.findChatMember(sourceChatId, userId);
    if (!isSourceMember) {
      this.logger.warn({
        eventType: 'message_forward_source_membership_denied',
        hasSourceChatId: !!sourceChatId,
        hasUserId: !!userId,
      });
      throw new ForbiddenException('Not a member of the source chat');
    }

    const isTargetMember = await this.repo.findChatMember(targetChatId, userId);
    if (!isTargetMember) {
      this.logger.warn({
        eventType: 'message_forward_target_membership_denied',
        hasTargetChatId: !!targetChatId,
        hasUserId: !!userId,
      });
      throw new ForbiddenException('Not a member of the target chat');
    }

    const messages: Message[] = [];
    let missingCount = 0;
    let wrongChatCount = 0;
    for (const msgId of messageIds) {
      const original = await this.repo.findMessageById(msgId);
      if (!original) {
        missingCount += 1;
        continue;
      }
      if (original.chatId !== sourceChatId) {
        wrongChatCount += 1;
        continue;
      }

      const copied = await this.repo.createMessage({
        chatId: targetChatId,
        clientId: null,
        senderId: userId,
        type: original.type,
        text: original.text,
        fileId: original.fileId,
        fileBucket: original.fileBucket,
        fileKey: original.fileKey,
        fileName: original.fileName,
        fileSize: original.fileSize,
        fileMime: original.fileMime,
        fileCategory: original.fileCategory ?? null,
        forwardedFromId: original.forwardedFromId ?? original.id,
        forwardedFromSenderId: original.forwardedFromSenderId ?? original.senderId,
        forwardedFromCreatedAt: original.forwardedFromCreatedAt ?? original.createdAt,
        forwardedFromType: original.forwardedFromType ?? original.type,
        forwardedFromText: original.forwardedFromText ?? original.text,
        forwardedFromFileName: original.forwardedFromFileName ?? original.fileName,
      });
      messages.push(copied);
    }

    if (missingCount > 0) {
      this.logger.warn({
        eventType: 'message_forward_source_missing',
        hasSourceChatId: !!sourceChatId,
        missingCount,
      });
    }
    if (wrongChatCount > 0) {
      this.logger.warn({
        eventType: 'message_forward_source_chat_mismatch',
        hasSourceChatId: !!sourceChatId,
        mismatchCount: wrongChatCount,
      });
    }
    this.logger.log({
      eventType: 'messages_forwarded',
      requestedCount: messageIds.length,
      createdCount: messages.length,
      missingCount,
      wrongChatCount,
    });

    return messages;
  }

  async prepareForwardMessages(data: ForwardMessagesData): Promise<PreparedForwardMessage[]> {
    const { sourceChatId, targetChatId, messageIds, userId } = data;
    this.logger.log({
      eventType: 'message_forward_prepare_requested',
      hasSourceChatId: !!sourceChatId,
      hasTargetChatId: !!targetChatId,
      hasUserId: !!userId,
      messageCount: messageIds.length,
    });

    const [sourceMember, targetMember] = await Promise.all([
      this.repo.findChatMember(sourceChatId, userId),
      this.repo.findChatMember(targetChatId, userId),
    ]);
    if (!sourceMember || !targetMember) {
      this.logger.warn({
        eventType: 'message_forward_prepare_denied',
        hasSourceChatId: !!sourceChatId,
        hasTargetChatId: !!targetChatId,
        hasUserId: !!userId,
        hasSourceMembership: !!sourceMember,
        hasTargetMembership: !!targetMember,
      });
      throw new ForbiddenException('Not a member of a forwarded chat');
    }

    if (messageIds.length === 0) {
      this.logger.debug({
        eventType: 'message_forward_prepare_skipped',
        messageCount: 0,
        skippedCount: 0,
      });
      return [];
    }

    const visibleMessages = this.repo.findVisibleMessagesByIds
      ? await this.repo.findVisibleMessagesByIds(sourceChatId, messageIds, userId)
      : (await Promise.all(messageIds.map((messageId) => this.repo.findMessageById(messageId))))
        .filter((message): message is Message => (
          message !== null && message.chatId === sourceChatId && message.deletedAt === null
        ));
    const messagesById = new Map(visibleMessages.map((message) => [message.id, message]));
    const prepared = messageIds.flatMap((messageId) => {
      const message = messagesById.get(messageId);
      return message ? [this.toPreparedForwardMessage(message)] : [];
    });
    const skippedCount = messageIds.length - prepared.length;

    if (skippedCount > 0) {
      this.logger.warn({
        eventType: 'message_forward_prepare_skipped',
        messageCount: messageIds.length,
        skippedCount,
      });
    }
    this.logger.log({
      eventType: 'message_forward_prepare_completed',
      messageCount: messageIds.length,
      preparedCount: prepared.length,
      skippedCount,
    });

    return prepared;
  }

  async cloneForwardMessages(data: CloneForwardMessagesData): Promise<Message[]> {
    const { targetChatId, userId, messages } = data;
    this.logger.log({
      eventType: 'message_forward_clone_requested',
      hasTargetChatId: !!targetChatId,
      hasUserId: !!userId,
      messageCount: messages.length,
      attachmentCount: messages.reduce((count, message) => count + message.attachments.length, 0),
    });

    const targetMember = await this.repo.findChatMember(targetChatId, userId);
    if (!targetMember) {
      this.logger.warn({
        eventType: 'message_forward_clone_failed',
        hasTargetChatId: !!targetChatId,
        hasUserId: !!userId,
        messageCount: messages.length,
        createdCount: 0,
        reason: 'target_membership_denied',
      });
      throw new ForbiddenException('Not a member of the target chat');
    }

    const cloned: Message[] = [];
    try {
      for (const message of messages) {
        const created = await this.repo.createMessageWithRelations({
          chatId: targetChatId,
          clientId: null,
          senderId: userId,
          type: message.type,
          text: message.text,
          attachments: message.attachments,
          forwardContext: this.buildForwardContext(message),
        });
        await this.createForwardAttachmentReferences(created, message.attachments.length);
        cloned.push(created);
        this.logger.log({
          eventType: 'message_attachment_clone_created',
          hasMessageId: !!created.id,
          attachmentCount: message.attachments.length,
        });
      }
    } catch (error) {
      this.logger.error({
        eventType: 'message_forward_clone_failed',
        hasTargetChatId: !!targetChatId,
        hasUserId: !!userId,
        messageCount: messages.length,
        createdCount: cloned.length,
        hasError: !!error,
      });
      throw error;
    }

    this.logger.log({
      eventType: 'message_forward_clone_created',
      hasTargetChatId: !!targetChatId,
      messageCount: messages.length,
      createdCount: cloned.length,
      attachmentCount: messages.reduce((count, message) => count + message.attachments.length, 0),
    });
    return cloned;
  }

  private toPreparedForwardMessage(message: Message): PreparedForwardMessage {
    return {
      messageId: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      type: message.type,
      text: message.text,
      createdAt: message.createdAt,
      attachments: message.attachments.map((attachment) => ({
        mediaId: attachment.mediaId,
        fileNameSnapshot: attachment.fileNameSnapshot,
        fileSizeSnapshot: attachment.fileSizeSnapshot,
        mimeSnapshot: attachment.mimeSnapshot,
        category: attachment.category,
      })),
      forwardContext: message.forwardContext
        ? {
            originalMessageId: message.forwardContext.originalMessageId,
            originalChatId: message.forwardContext.originalChatId,
            originalAuthorId: message.forwardContext.originalAuthorId,
            originalAuthorNameSnapshot: message.forwardContext.originalAuthorNameSnapshot,
            originalAuthorDisplayNameSnapshot:
              message.forwardContext.originalAuthorDisplayNameSnapshot,
            originalMessageCreatedAt: message.forwardContext.originalMessageCreatedAt,
            originalMessageType: message.forwardContext.originalMessageType,
            originalTextPreview: message.forwardContext.originalTextPreview,
            originalFileNamePreview: message.forwardContext.originalFileNamePreview,
          }
        : null,
    };
  }

  private buildForwardContext(message: CloneForwardMessageInput): CreateMessageForwardContextData {
    if (message.forwardContext) return message.forwardContext;

    return {
      originalMessageId: message.messageId,
      originalChatId: message.chatId,
      originalAuthorId: message.originalAuthorId,
      originalAuthorNameSnapshot: message.originalAuthorNameSnapshot,
      originalAuthorDisplayNameSnapshot: message.originalAuthorDisplayNameSnapshot,
      originalMessageCreatedAt: message.createdAt,
      originalMessageType: message.type,
      originalTextPreview: message.text,
      originalFileNamePreview: message.attachments[0]?.fileNameSnapshot ?? null,
    };
  }

  private async createForwardAttachmentReferences(
    message: Message,
    attachmentCount: number,
  ): Promise<void> {
    if (attachmentCount === 0) return;

    const attachments = message.attachments ?? [];
    if (attachments.length !== attachmentCount || !this.mediaClient) {
      const error = new Error('Forwarded message attachments could not be protected');
      this.logger.error({
        eventType: 'message_forward_clone_failed',
        hasMessageId: !!message.id,
        attachmentCount,
        hasMediaClient: !!this.mediaClient,
      });
      await this.compensateFailedForwardClone(message, []);
      throw error;
    }

    const referencedAttachments: Message['attachments'] = [];
    try {
      for (const attachment of attachments) {
        await lastValueFrom(this.mediaClient.send(MEDIA_PATTERNS.CREATE_REFERENCE, {
          fileId: attachment.mediaId,
          ownerType: 'MESSAGE_ATTACHMENT',
          ownerId: attachment.id,
        }));
        referencedAttachments.push(attachment);
      }
    } catch (error) {
      await this.compensateFailedForwardClone(message, referencedAttachments);
      throw error;
    }

    this.logger.log({
      eventType: 'media_reference_created',
      hasMessageId: !!message.id,
      referenceCount: referencedAttachments.length,
    });
  }

  private async compensateFailedForwardClone(
    message: Message,
    referencedAttachments: Message['attachments'],
  ): Promise<void> {
    if (this.mediaClient) {
      for (const attachment of referencedAttachments) {
        try {
          await lastValueFrom(this.mediaClient.send(MEDIA_PATTERNS.DELETE_REFERENCE, {
            fileId: attachment.mediaId,
            ownerType: 'MESSAGE_ATTACHMENT',
            ownerId: attachment.id,
          }));
        } catch (error) {
          this.logger.warn({
            eventType: 'media_reference_delete_skipped',
            hasMessageId: !!message.id,
            hasError: !!error,
          });
        }
      }
    }

    try {
      await this.repo.deleteCreatedMessage(message.id);
    } catch (error) {
      this.logger.error({
        eventType: 'message_forward_clone_failed',
        hasMessageId: !!message.id,
        hasError: !!error,
        reason: 'compensation_failed',
      });
    }
  }

  async markRead(
    chatId: string,
    userId: string,
    messageId?: string | null,
  ): Promise<ChatMember> {
    this.logger.debug({
      eventType: 'chat_read_mark_requested',
      hasChatId: !!chatId,
      hasUserId: !!userId,
      hasMessageId: !!messageId,
    });
    const member = await this.repo.findChatMember(chatId, userId);
    if (!member) {
      this.logger.warn({
        eventType: 'chat_membership_denied',
        hasChatId: !!chatId,
        hasUserId: !!userId,
      });
      throw new ForbiddenException('Not a member of this chat');
    }
    const chatMember = await this.repo.markChatRead(chatId, userId, messageId ?? null);
    this.logger.log({
      eventType: 'chat_read_marked',
      hasChatId: !!chatId,
      hasUserId: !!userId,
      hasMessageId: !!messageId,
    });
    return chatMember;
  }

  async checkMembership(chatId: string, userId: string): Promise<boolean> {
    const member = await this.repo.findChatMember(chatId, userId);
    return member !== null;
  }

  async getMembers(chatId: string): Promise<{ userId: string }[]> {
    const members = await this.repo.findMembersByChat(chatId);
    return members.map((m) => ({ userId: m.userId }));
  }

  private async requireMember(chatId: string, userId: string): Promise<void> {
    const member = await this.repo.findChatMember(chatId, userId);
    if (!member) throw new ForbiddenException('Not a member of this chat');
  }

  private async requireMessageInChat(chatId: string, messageId: string): Promise<Message> {
    const message = await this.repo.findMessageById(messageId);
    if (!message || message.chatId !== chatId) throw new NotFoundException('Message not found');
    return message;
  }
}
