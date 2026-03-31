import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Chat, Message } from '@org/common';
import { CHAT_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import type { ChatWithPreview, IChatRepository, IChatService } from '../interfaces/chat.interface';

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

  async getMessages(chatId: string, userId: string, skip = 0, take = 50): Promise<Message[]> {
    const member = await this.repo.findChatMember(chatId, userId);
    if (!member) throw new ForbiddenException('Not a member of this chat');
    return this.repo.findMessagesByChat(chatId, skip, take);
  }

  async sendMessage(chatId: string, senderId: string, text: string): Promise<Message> {
    const member = await this.repo.findChatMember(chatId, senderId);
    if (!member) throw new ForbiddenException('Not a member of this chat');
    return this.repo.createMessage({ chatId, senderId, text });
  }

  async checkMembership(chatId: string, userId: string): Promise<boolean> {
    const member = await this.repo.findChatMember(chatId, userId);
    return member !== null;
  }
}
