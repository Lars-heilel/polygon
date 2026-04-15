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
      socket.data['userId'] = payload.sub;
      this.logger.log(`WS connected: userId=${payload.sub}`);
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`WS disconnected: socketId=${socket.id}`);
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
    }
  }

  @SubscribeMessage('chat:leave')
  async handleLeave(@ConnectedSocket() socket: Socket, @MessageBody() payload: { chatId: string }) {
    await socket.leave(`chat:${payload.chatId}`);
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

  broadcastMessage(chatId: string, message: unknown) {
    this.server.to(`chat:${chatId}`).emit('message:new', message);
  }
}
