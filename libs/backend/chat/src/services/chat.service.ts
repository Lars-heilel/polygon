import { ForbiddenException, Injectable } from '@nestjs/common';
import { ChatType } from '../database/generated/prisma/enums';
import { ChatPrismaRepository } from '../database/repository/chat.prisma.repo';

@Injectable()
export class ChatService {
  constructor(private readonly repo: ChatPrismaRepository) {}

  async createDirectChat(userId: string, targetUserId: string) {
    const existing = await this.repo.findDirectChatBetween(userId, targetUserId);
    if (existing) return existing;

    const chat = await this.repo.createChat({
      type: ChatType.DIRECT,
      createdAt: new Date(),
    });

    await this.repo.addChatMember({ chatId: chat.id, userId });
    await this.repo.addChatMember({ chatId: chat.id, userId: targetUserId });

    return this.repo.findChatById(chat.id);
  }

  async getChats(userId: string) {
    return this.repo.findChatsForUser(userId);
  }

  async getMessages(chatId: string, userId: string, skip = 0, take = 50) {
    const member = await this.repo.findChatMember(chatId, userId);
    if (!member) throw new ForbiddenException('Not a member of this chat');

    return this.repo.findMessagesByChat(chatId, skip, take);
  }

  async sendMessage(chatId: string, senderId: string, text: string) {
    const member = await this.repo.findChatMember(chatId, senderId);
    if (!member) throw new ForbiddenException('Not a member of this chat');

    return this.repo.createMessage({ chatId, senderId, text });
  }

  async checkMembership(chatId: string, userId: string): Promise<boolean> {
    const member = await this.repo.findChatMember(chatId, userId);
    return member !== null;
  }
}
