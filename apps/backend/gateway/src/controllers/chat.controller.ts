import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import {
  CHAT_CLIENT_TOKEN,
  CHAT_PATTERNS,
  CurrentUser,
  JwtGuard,
  type JwtPayload,
} from '@org/core';
import { ChatSocketGateway } from '../gateways/chat.socket-gateway';
import { CreateDirectChatDto } from '../dto/create-direct-chat.dto';
import { SendMessageDto } from '../dto/send-message.dto';

@Controller('chats')
@UseGuards(JwtGuard)
export class ChatGatewayController {
  constructor(
    @Inject(CHAT_CLIENT_TOKEN) private readonly chatClient: ClientProxy,
    private readonly socketGateway: ChatSocketGateway
  ) {}

  @Post('direct')
  createDirect(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDirectChatDto
  ) {
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.CREATE_DIRECT, {
        userId: user.sub,
        targetUserId: dto.targetUserId,
      })
    );
  }

  @Get()
  getChats(@CurrentUser() user: JwtPayload) {
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.GET_CHATS, { userId: user.sub })
    );
  }

  @Get(':id/messages')
  getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string
  ) {
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.GET_MESSAGES, {
        chatId,
        userId: user.sub,
        skip: skip ? parseInt(skip, 10) : undefined,
        take: take ? parseInt(take, 10) : undefined,
      })
    );
  }

  @Post(':id/messages')
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Body() dto: SendMessageDto
  ) {
    const message = await this.send(
      this.chatClient.send(CHAT_PATTERNS.SEND_MESSAGE, {
        chatId,
        senderId: user.sub,
        text: dto.text,
      })
    );

    this.socketGateway.broadcastMessage(chatId, message);

    return message;
  }

  private async send<T>(observable: Observable<T>): Promise<T> {
    try {
      return await lastValueFrom(observable);
    } catch (err) {
      const error = err as { statusCode?: number; message?: string };
      throw new HttpException(
        error.message ?? 'Internal server error',
        error.statusCode ?? 500
      );
    }
  }
}
