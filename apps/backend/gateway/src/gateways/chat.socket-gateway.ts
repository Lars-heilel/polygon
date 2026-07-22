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
  TokenService,
  USER_CLIENT_TOKEN,
  USER_PATTERNS,
} from '@org/core';
import { lastValueFrom } from 'rxjs';
import { Server, Socket } from 'socket.io';

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
  ) {}

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
  }

  handleDisconnect(socket: Socket) {
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
        const chats = this.userChats.get(userId);
        if (chats) {
          chats.forEach((chatId) => {
            this.server.to(`chat:${chatId}`).emit('user:offline', { userId, chatId });
          });
          this.userChats.delete(userId);
        }
      }
    }
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && (this.userSockets.get(userId)?.size ?? 0) > 0;
  }

  disconnectUser(userId: string): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;

    for (const socketId of sockets) {
      this.server.sockets.sockets.get(socketId)?.disconnect(true);
    }

    this.userSockets.delete(userId);
    this.userChats.delete(userId);
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
      hasFile: !!payload.fileId,
    });

    const message = await lastValueFrom(
      this.chatClient.send(CHAT_PATTERNS.SEND_MESSAGE, {
        chatId: payload.chatId,
        clientId: payload.clientId ?? null,
        senderId: userId,
        type: payload.type ?? 'TEXT',
        text: payload.text ?? null,
        fileId: payload.fileId ?? null,
        fileBucket: payload.fileBucket ?? null,
        fileKey: payload.fileKey ?? null,
        fileName: payload.fileName ?? null,
        fileSize: payload.fileSize ?? null,
        fileMime: payload.fileMime ?? null,
        fileCategory: payload.fileCategory ?? null,
      }),
    ).catch((err: unknown) => {
      this.logger.error({
        eventType: 'message_send_failed',
        hasChatId: !!payload.chatId,
        hasClientId: !!payload.clientId,
        hasError: !!err,
      });
      if (payload.clientId) {
        socket.emit('message:send:error', {
          chatId: payload.chatId,
          clientId: payload.clientId,
        });
      }
      return null;
    });

    if (message) {
      this.broadcastMessage(payload.chatId, message);
      await this.triggerPushForOfflineRecipients(payload.chatId, userId, message);
    }
  }

  async triggerPushForOfflineRecipients(
    chatId: string,
    senderId: string,
    message: { text?: string | null; [key: string]: unknown },
  ) {
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

        const online = this.isUserOnline(member.userId);
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
    } catch (err) {
      this.logger.error({
        eventType: 'push_offline_recipients_failed',
        hasChatId: !!chatId,
        hasError: !!err,
      });
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(@ConnectedSocket() socket: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) return;
    this.server
      .to(`chat:${payload.chatId}`)
      .emit('user:typing', { userId, chatId: payload.chatId, isTyping: true });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(@ConnectedSocket() socket: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) return;
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
