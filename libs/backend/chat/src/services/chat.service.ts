import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Chat, Message, MessagePage } from '@org/common';
import { CHAT_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import type {
  ChatWithPreview,
  ForwardMessagesData,
  IChatRepository,
  IChatService,
} from '../interfaces/chat.interface';

@Injectable()
export class ChatService implements IChatService {
  constructor(@Inject(CHAT_PRISMA_REPOSITORY_TOKEN) private readonly repo: IChatRepository) {}

  async createDirectChat(userId: string, targetUserId: string): Promise<Chat> {
    const existing = await this.repo.findDirectChatBetween(userId, targetUserId);
    if (existing) return existing;

    const chat = await this.repo.createChat({ type: 'DIRECT' });
    await this.repo.addChatMember({ chatId: chat.id, userId });
    await this.repo.addChatMember({ chatId: chat.id, userId: targetUserId });

    return this.repo.findChatById(chat.id).then((c) => {
      if (!c) throw new NotFoundException('Chat not found after creation');
      return c;
    });
  }

  async getChats(userId: string): Promise<ChatWithPreview[]> {
    return this.repo.findChatsForUser(userId);
  }

  async getMessages(
    chatId: string,
    userId: string,
    cursor: string | undefined,
    take = 50,
  ): Promise<MessagePage> {
    const member = await this.repo.findChatMember(chatId, userId);
    if (!member) throw new ForbiddenException('Not a member of this chat');
    return this.repo.findMessagesByChat(chatId, cursor, take);
  }

  async sendMessage(
    chatId: string,
    senderId: string,
    input: {
      type: string;
      text?: string | null;
      fileId?: string | null;
      fileBucket?: string | null;
      fileKey?: string | null;
      fileName?: string | null;
      fileSize?: number | null;
      fileMime?: string | null;
    },
  ): Promise<Message> {
    const member = await this.repo.findChatMember(chatId, senderId);
    if (!member) throw new ForbiddenException('Not a member of this chat');

    return this.repo.createMessage({
      chatId,
      senderId,
      type: input.type as Message['type'],
      text: input.text ?? null,
      fileId: input.fileId ?? null,
      fileBucket: input.fileBucket ?? null,
      fileKey: input.fileKey ?? null,
      fileName: input.fileName ?? null,
      fileSize: input.fileSize ?? null,
      fileMime: input.fileMime ?? null,
    });
  }

  async forwardMessages(data: ForwardMessagesData): Promise<Message[]> {
    const { sourceChatId, targetChatId, messageIds, userId } = data;

    const isSourceMember = await this.repo.findChatMember(sourceChatId, userId);
    if (!isSourceMember) throw new ForbiddenException('Not a member of the source chat');

    const isTargetMember = await this.repo.findChatMember(targetChatId, userId);
    if (!isTargetMember) throw new ForbiddenException('Not a member of the target chat');

    const messages: Message[] = [];
    for (const msgId of messageIds) {
      const original = await this.repo.findMessageById(msgId);
      if (!original || original.chatId !== sourceChatId) continue;

      const copied = await this.repo.createMessage({
        chatId: targetChatId,
        senderId: userId,
        type: original.type,
        text: original.text,
        fileId: original.fileId,
        fileBucket: original.fileBucket,
        fileKey: original.fileKey,
        fileName: original.fileName,
        fileSize: original.fileSize,
        fileMime: original.fileMime,
        forwardedFromId: original.id,
      });
      messages.push(copied);
    }

    return messages;
  }

  async checkMembership(chatId: string, userId: string): Promise<boolean> {
    const member = await this.repo.findChatMember(chatId, userId);
    return member !== null;
  }
}
