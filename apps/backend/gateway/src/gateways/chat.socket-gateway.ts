import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  BanMarkerRepository,
  CHAT_CLIENT_TOKEN,
  CHAT_PATTERNS,
  NOTIFICATION_CLIENT_TOKEN,
  NOTIFICATION_EVENTS,
  REDIS_CLIENT,
  TokenService,
  USER_CLIENT_TOKEN,
  USER_PATTERNS,
} from '@org/core';
import { sendMessageSchema } from '@org/common';
import { lastValueFrom } from 'rxjs';
import { Server, Socket } from 'socket.io';
import type Redis from 'ioredis';

import { GatewayChatCacheService } from '../cache/gateway-chat-cache.service';

interface SocketMessageAttachmentPayload {
  mediaId: string;
  fileNameSnapshot?: string | null;
  fileSizeSnapshot?: number | null;
  mimeSnapshot?: string | null;
  category: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env['CLIENT_URL'] ?? 'http://localhost:4200',
    credentials: true,
  },
})
export class ChatSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(ChatSocketGateway.name);

  private readonly userSockets = new Map<string, Set<string>>();
  private readonly userChats = new Map<string, Set<string>>();

  constructor(
    private readonly tokenService: TokenService,
    @Inject(CHAT_CLIENT_TOKEN) private readonly chatClient: ClientProxy,
    @Inject(NOTIFICATION_CLIENT_TOKEN) private readonly notificationClient: ClientProxy,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
    private readonly banMarkers: BanMarkerRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly chatCache: GatewayChatCacheService,
  ) {}

  private presenceKey(userId: string): string {
    return `presence:${userId}`;
  }

  private typingKey(chatId: string, userId: string): string {
    return `typing:${chatId}:${userId}`;
  }

  private async markOnline(userId: string, socketId: string): Promise<void> {
    await this.redis.sadd(this.presenceKey(userId), socketId).catch(() => undefined);
    await this.redis.expire(this.presenceKey(userId), 120).catch(() => undefined);
  }

  private async markOfflineSocket(userId: string, socketId: string): Promise<boolean> {
    try {
      await this.redis.srem(this.presenceKey(userId), socketId);
      const remaining = await this.redis.scard(this.presenceKey(userId));
      if (remaining === 0) {
        await this.redis.del(this.presenceKey(userId));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async handleConnection(socket: Socket): Promise<void> {
    const cookieHeader = socket.handshake.headers.cookie ?? '';
    const token = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('access_token='))
      ?.slice('access_token='.length);

    if (!token) {
      socket.disconnect();
      return;
    }

    let userId: string;
    try {
      const payload = this.tokenService.verifyAccessToken(token);
      userId = payload.sub;
    } catch {
      socket.disconnect(true);
      return;
    }

    try {
      const marker = await this.banMarkers.findActiveMarker(userId);

      if (marker) {
        socket.emit('auth:error', {
          code: 'ACCOUNT_BANNED',
          reason: marker.reason,
          bannedUntil: marker.bannedUntil,
        });
        socket.disconnect(true);
        return;
      }
    } catch (error) {
      this.logger.warn({
        eventType: 'ws_ban_check_failed',
        hasUserId: !!userId,
        hasError: !!error,
      });
      socket.emit('auth:error', { code: 'ACCOUNT_BAN_CHECK_UNAVAILABLE' });
      socket.disconnect(true);
      return;
    }

    socket.data['userId'] = userId;
    this.logger.log({
      eventType: 'ws_connected',
      hasUserId: !!userId,
    });

    const sockets = this.userSockets.get(userId) ?? new Set();
    sockets.add(socket.id);
    this.userSockets.set(userId, sockets);

    await this.markOnline(userId, socket.id);
    await this.rejoinChats(socket, userId);
  }

  private async rejoinChats(socket: Socket, userId: string): Promise<void> {
    const chats = await lastValueFrom(
      this.chatClient.send(CHAT_PATTERNS.GET_CHATS, { userId }),
    ).catch(() => null);
    if (!Array.isArray(chats)) return;

    const joined: string[] = [];
    for (const chat of chats as { id?: unknown }[]) {
      if (typeof chat.id !== 'string') continue;
      try {
        await socket.join(`chat:${chat.id}`);
      } catch {
        /* join failed — client will re-emit chat:join */
      }
      joined.push(chat.id);
    }
    if (joined.length === 0) return;

    this.userChats.set(userId, new Set(joined));
    this.logger.log({
      eventType: 'ws_chats_rejoined',
      hasUserId: !!userId,
      chatCount: joined.length,
    });
    for (const chatId of joined) {
      this.server.to(`chat:${chatId}`).emit('user:online', { userId, chatId });
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const userId = socket.data['userId'] as string | undefined;
    this.logger.log({
      eventType: 'ws_disconnected',
      hasSocketId: !!socket.id,
      hasUserId: !!userId,
    });

    if (!userId) return;

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    const fullyOffline = await this.markOfflineSocket(userId, socket.id);
    if (fullyOffline || !this.userSockets.has(userId)) {
      const chats = this.userChats.get(userId);
      if (chats) {
        chats.forEach((chatId) => {
          this.server.to(`chat:${chatId}`).emit('user:offline', { userId, chatId });
        });
        this.userChats.delete(userId);
      }
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const count = await this.redis.exists(this.presenceKey(userId));
      return count === 1;
    } catch {
      return false;
    }
  }

  disconnectUser(userId: string): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;

    for (const socketId of sockets) {
      this.server.sockets.sockets.get(socketId)?.disconnect(true);
    }

    this.userSockets.delete(userId);
    this.userChats.delete(userId);
    this.redis.del(this.presenceKey(userId)).catch(() => undefined);
  }

  @SubscribeMessage('chat:join')
  async handleJoin(@ConnectedSocket() socket: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = socket.data['userId'] as string;
    if (!userId) return;

    const isMember = await lastValueFrom(
      this.chatClient.send<boolean>(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
        chatId: payload.chatId,
        userId,
      }),
    ).catch(() => false);

    if (isMember) {
      await socket.join(`chat:${payload.chatId}`);
      this.logger.log({
        eventType: 'chat_joined',
        hasUserId: !!userId,
        hasChatId: !!payload.chatId,
      });

      const chats = this.userChats.get(userId) ?? new Set();
      const isFirstJoin = chats.size === 0;
      chats.add(payload.chatId);
      this.userChats.set(userId, chats);

      if (isFirstJoin) {
        this.server
          .to(`chat:${payload.chatId}`)
          .emit('user:online', { userId, chatId: payload.chatId });
      }
    } else {
      this.logger.warn({
        eventType: 'chat_membership_denied',
        hasUserId: !!userId,
        hasChatId: !!payload.chatId,
      });
    }
  }

  @SubscribeMessage('chat:leave')
  async handleLeave(@ConnectedSocket() socket: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = socket.data['userId'] as string;
    await socket.leave(`chat:${payload.chatId}`);

    if (userId) {
      const chats = this.userChats.get(userId);
      if (chats) {
        chats.delete(payload.chatId);
        if (chats.size === 0) {
          this.userChats.delete(userId);
        }
      }
    }
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    payload: {
      chatId: string;
      clientId?: string | null;
      text?: string;
      type?: string;
      fileId?: string;
      fileBucket?: string;
      fileKey?: string;
      fileName?: string;
      fileSize?: number;
      fileMime?: string;
      fileCategory?: string;
      attachments?: SocketMessageAttachmentPayload[];
    },
  ) {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) return;

    this.logger.debug({
      eventType: 'socket_message_send_requested',
      hasUserId: !!userId,
      hasChatId: !!payload.chatId,
      hasClientId: !!payload.clientId,
      type: payload.type ?? 'TEXT',
      hasText: !!payload.text,
      hasFile: !!payload.fileId || !!payload.attachments?.length,
    });

    const parsed = sendMessageSchema.safeParse({
      clientId: payload.clientId,
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

    if (!parsed.success) {
      this.logger.warn({
        eventType: 'socket_message_send_validation_failed',
        hasUserId: !!userId,
        hasChatId: !!payload.chatId,
        hasClientId: !!payload.clientId,
        issueCount: parsed.error.issues.length,
      });
      socket.emit('message:send:error', {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Invalid message payload',
        chatId: payload.chatId,
        clientId: payload.clientId ?? null,
      });
      return;
    }

    const isMember = await lastValueFrom(
      this.chatClient.send<boolean>(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
        chatId: payload.chatId,
        userId,
      }),
    ).catch(() => false);

    if (!isMember) {
      this.logger.warn({
        eventType: 'socket_message_send_denied',
        hasUserId: !!userId,
        hasChatId: !!payload.chatId,
        hasClientId: !!payload.clientId,
      });
      socket.emit('message:send:error', {
        code: 'FORBIDDEN',
        message: 'Not a member of this chat',
        chatId: payload.chatId,
        clientId: payload.clientId ?? null,
      });
      return;
    }

    const message = await lastValueFrom(
      this.chatClient.send(CHAT_PATTERNS.SEND_MESSAGE, {
        chatId: payload.chatId,
        clientId: parsed.data.clientId ?? null,
        senderId: userId,
        type: parsed.data.type,
        text: parsed.data.text ?? null,
        fileId: parsed.data.fileId ?? null,
        fileBucket: parsed.data.fileBucket ?? null,
        fileKey: parsed.data.fileKey ?? null,
        fileName: parsed.data.fileName ?? null,
        fileSize: parsed.data.fileSize ?? null,
        fileMime: parsed.data.fileMime ?? null,
        fileCategory: parsed.data.fileCategory ?? null,
        attachments: parsed.data.attachments ?? [],
      }),
    ).catch((err: unknown) => {
      this.logger.error({
        eventType: 'message_send_failed',
        hasChatId: !!payload.chatId,
        hasClientId: !!payload.clientId,
        hasError: !!err,
      });
      socket.emit('message:send:error', {
        code: 'SEND_FAILED',
        message: 'Failed to send message',
        chatId: payload.chatId,
        clientId: payload.clientId ?? null,
      });
      return null;
    });

    if (message) {
      this.broadcastMessage(payload.chatId, message);
      let memberIds = await this.triggerPushForOfflineRecipients(payload.chatId, userId, message);
      if (memberIds.length === 0) {
        memberIds = await lastValueFrom(
          this.chatClient.send<{ userId: string }[]>(CHAT_PATTERNS.GET_MEMBERS, {
            chatId: payload.chatId,
          }),
        )
          .then((members) =>
            Array.isArray(members)
              ? members.filter((m) => typeof m.userId === 'string').map((m) => m.userId)
              : [],
          )
          .catch(() => [] as string[]);
      }
      await this.chatCache.invalidateChatPages(payload.chatId);
      for (const memberId of memberIds) {
        await this.chatCache.invalidateChatList(memberId);
      }
    }
  }

  async triggerPushForOfflineRecipients(
    chatId: string,
    senderId: string,
    message: { text?: string | null; [key: string]: unknown },
  ): Promise<string[]> {
    try {
      const [members, sender] = await Promise.all([
        lastValueFrom<{ userId: string }[]>(
          this.chatClient.send(CHAT_PATTERNS.GET_MEMBERS, { chatId }),
        ),
        lastValueFrom<{ name: string; displayName: string | null }>(
          this.userClient.send(USER_PATTERNS.GET_BY_ID, { id: senderId }),
        ).catch(() => ({ name: 'Unknown', displayName: null })),
      ]);

      this.logger.log({
        eventType: 'push_offline_recipients_start',
        hasChatId: !!chatId,
        totalMembers: members.length,
        hasSenderName: !!(sender.displayName ?? sender.name),
      });

      const senderName = sender.displayName ?? sender.name;

      let skippedOnline = 0;
      let sent = 0;

      for (const member of members) {
        if (member.userId === senderId) continue;

        const online = await this.isUserOnline(member.userId);
        this.logger.debug({
          eventType: 'push_recipient_online_check',
          online,
        });

        if (online) {
          skippedOnline++;
          continue;
        }

        const preview = getMessagePreview(message);

        this.notificationClient.emit(NOTIFICATION_EVENTS.SEND_PUSH, {
          userId: member.userId,
          title: senderName,
          body: preview,
          tag: chatId,
          eventType: 'MESSAGE',
          data: { chatId, messageId: message['id'] as string },
        });
        sent++;
      }

      this.logger.log({
        eventType: 'push_offline_recipients_complete',
        hasChatId: !!chatId,
        skippedOnline,
        pushSent: sent,
      });
      return members.map((member) => member.userId);
    } catch (err) {
      this.logger.error({
        eventType: 'push_offline_recipients_failed',
        hasChatId: !!chatId,
        hasError: !!err,
      });
      return [];
    }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(@ConnectedSocket() socket: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) return;
    await this.redis.set(this.typingKey(payload.chatId, userId), '1', 'EX', 3).catch(() => undefined);
    this.server
      .to(`chat:${payload.chatId}`)
      .emit('user:typing', { userId, chatId: payload.chatId, isTyping: true });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(@ConnectedSocket() socket: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) return;
    await this.redis.del(this.typingKey(payload.chatId, userId)).catch(() => undefined);
    this.server
      .to(`chat:${payload.chatId}`)
      .emit('user:typing', { userId, chatId: payload.chatId, isTyping: false });
  }

  broadcastMessage(chatId: string, message: unknown) {
    this.server.to(`chat:${chatId}`).emit('message:new', message);
  }

  broadcastMessageUpdated(chatId: string, message: unknown): void {
    this.server.to(`chat:${chatId}`).emit('message:updated', message);
  }

  broadcastMessageDeleted(chatId: string, messageId: string): void {
    this.server.to(`chat:${chatId}`).emit('message:deleted', { chatId, messageId });
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;

    for (const socketId of sockets) {
      this.server.to(socketId).emit(event, payload);
    }
  }
}

function getMessagePreview(message: { text?: string | null; fileCategory?: unknown; fileName?: unknown }): string {
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (text) {
    return text.length > 100 ? `${text.slice(0, 100)}…` : text;
  }

  switch (message.fileCategory) {
    case 'IMAGE':
      return '🖼 Фото';
    case 'VIDEO':
      return '🎬 Видео';
    case 'CIRCLE':
      return '⭕ Видеосообщение';
    case 'VOICE':
      return '🎤 Голосовое сообщение';
    case 'AUDIO':
      return '🎵 Аудиофайл';
    case 'FILE':
      return `📄 ${typeof message.fileName === 'string' && message.fileName ? message.fileName : 'Файл'}`;
    default:
      return '📎 Вложение';
  }
}
