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
import { CHAT_CLIENT_TOKEN, CHAT_PATTERNS, TokenService } from '@org/core';
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
  ) {}

  handleConnection(socket: Socket) {
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

    try {
      const payload = this.tokenService.verifyAccessToken(token);
      const userId = payload.sub;
      socket.data['userId'] = userId;
      this.logger.log(`WS connected: userId=${userId}`);

      const sockets = this.userSockets.get(userId) ?? new Set();
      sockets.add(socket.id);
      this.userSockets.set(userId, sockets);
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = socket.data['userId'] as string | undefined;
    this.logger.log(`WS disconnected: socketId=${socket.id}, userId=${userId}`);

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
      this.logger.log(`userId=${userId} joined chat:${payload.chatId}`);

      const chats = this.userChats.get(userId) ?? new Set();
      const isFirstJoin = chats.size === 0;
      chats.add(payload.chatId);
      this.userChats.set(userId, chats);

      if (isFirstJoin) {
        this.server
          .to(`chat:${payload.chatId}`)
          .emit('user:online', { userId, chatId: payload.chatId });
      }
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
    @MessageBody() payload: { chatId: string; text: string },
  ) {
    const userId = socket.data['userId'] as string | undefined;
    if (!userId) return;

    const message = await lastValueFrom(
      this.chatClient.send(CHAT_PATTERNS.SEND_MESSAGE, {
        chatId: payload.chatId,
        senderId: userId,
        text: payload.text,
      }),
    ).catch((err: { message?: string }) => {
      this.logger.error(`message:send error: ${err?.message}`);
      return null;
    });

    if (message) {
      this.broadcastMessage(payload.chatId, message);
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
}
