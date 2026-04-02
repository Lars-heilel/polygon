import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CHAT_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import { ChatService } from './chat.service';

const mockRepo = {
  findDirectChatBetween: jest.fn(),
  createChat: jest.fn(),
  addChatMember: jest.fn(),
  findChatById: jest.fn(),
  findChatsForUser: jest.fn(),
  findChatMember: jest.fn(),
  findMessagesByChat: jest.fn(),
  createMessage: jest.fn(),
};

const chat = {
  id: 'chat-1',
  type: 'DIRECT' as const,
  name: null,
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const message = {
  id: 'msg-1',
  chatId: 'chat-1',
  senderId: 'user-1',
  text: 'hello',
  createdAt: new Date(),
  updatedAt: new Date(),
};
const member = {
  id: 'member-1',
  chatId: 'chat-1',
  userId: 'user-1',
  role: 'MEMBER' as const,
  joinedAt: new Date(),
};

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [ChatService, { provide: CHAT_PRISMA_REPOSITORY_TOKEN, useValue: mockRepo }],
    }).compile();

    service = module.get(ChatService);
  });

  // ── createDirectChat ──────────────────────────────────────────────

  describe('createDirectChat', () => {
    it('returns existing chat if one already exists between the two users', async () => {
      mockRepo.findDirectChatBetween.mockResolvedValue(chat);

      const result = await service.createDirectChat('user-1', 'user-2');

      expect(result).toBe(chat);
      expect(mockRepo.createChat).not.toHaveBeenCalled();
    });

    it('creates chat and adds both members when no chat exists', async () => {
      mockRepo.findDirectChatBetween.mockResolvedValue(null);
      mockRepo.createChat.mockResolvedValue(chat);
      mockRepo.addChatMember.mockResolvedValue(member);
      mockRepo.findChatById.mockResolvedValue(chat);

      const result = await service.createDirectChat('user-1', 'user-2');

      expect(mockRepo.createChat).toHaveBeenCalledWith({ type: 'DIRECT' });
      expect(mockRepo.addChatMember).toHaveBeenCalledTimes(2);
      expect(mockRepo.addChatMember).toHaveBeenCalledWith({ chatId: chat.id, userId: 'user-1' });
      expect(mockRepo.addChatMember).toHaveBeenCalledWith({ chatId: chat.id, userId: 'user-2' });
      expect(result).toBe(chat);
    });

    it('throws NotFoundException if chat cannot be found after creation', async () => {
      mockRepo.findDirectChatBetween.mockResolvedValue(null);
      mockRepo.createChat.mockResolvedValue(chat);
      mockRepo.addChatMember.mockResolvedValue(member);
      mockRepo.findChatById.mockResolvedValue(null);

      await expect(service.createDirectChat('user-1', 'user-2')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getChats ──────────────────────────────────────────────────────

  describe('getChats', () => {
    it('returns chats for user', async () => {
      mockRepo.findChatsForUser.mockResolvedValue([chat]);

      const result = await service.getChats('user-1');

      expect(result).toEqual([chat]);
      expect(mockRepo.findChatsForUser).toHaveBeenCalledWith('user-1');
    });
  });

  // ── getMessages ───────────────────────────────────────────────────

  describe('getMessages', () => {
    it('returns messages when user is a member', async () => {
      mockRepo.findChatMember.mockResolvedValue(member);
      mockRepo.findMessagesByChat.mockResolvedValue([message]);

      const result = await service.getMessages('chat-1', 'user-1', 0, 50);

      expect(result).toEqual([message]);
      expect(mockRepo.findMessagesByChat).toHaveBeenCalledWith('chat-1', 0, 50);
    });

    it('throws ForbiddenException when user is not a member', async () => {
      mockRepo.findChatMember.mockResolvedValue(null);

      await expect(service.getMessages('chat-1', 'user-1', 0, 50)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.findMessagesByChat).not.toHaveBeenCalled();
    });
  });

  // ── sendMessage ───────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('creates and returns message when user is a member', async () => {
      mockRepo.findChatMember.mockResolvedValue(member);
      mockRepo.createMessage.mockResolvedValue(message);

      const result = await service.sendMessage('chat-1', 'user-1', 'hello');

      expect(result).toBe(message);
      expect(mockRepo.createMessage).toHaveBeenCalledWith({
        chatId: 'chat-1',
        senderId: 'user-1',
        text: 'hello',
      });
    });

    it('throws ForbiddenException when user is not a member', async () => {
      mockRepo.findChatMember.mockResolvedValue(null);

      await expect(service.sendMessage('chat-1', 'user-1', 'hello')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.createMessage).not.toHaveBeenCalled();
    });
  });

  // ── checkMembership ───────────────────────────────────────────────

  describe('checkMembership', () => {
    it('returns true when user is a member', async () => {
      mockRepo.findChatMember.mockResolvedValue(member);
      expect(await service.checkMembership('chat-1', 'user-1')).toBe(true);
    });

    it('returns false when user is not a member', async () => {
      mockRepo.findChatMember.mockResolvedValue(null);
      expect(await service.checkMembership('chat-1', 'user-1')).toBe(false);
    });
  });
});
