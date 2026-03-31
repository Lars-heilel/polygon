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
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CHAT_CLIENT_TOKEN,
  CHAT_PATTERNS,
  CurrentUser,
  JwtGuard,
  type JwtPayload,
} from '@org/core';
import { Observable, lastValueFrom } from 'rxjs';

import { CreateDirectChatDto } from '../dto/create-direct-chat.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { ChatSocketGateway } from '../gateways/chat.socket-gateway';

@ApiTags('chats')
@ApiCookieAuth('access_token')
@Controller('chats')
@UseGuards(JwtGuard)
export class ChatGatewayController {
  constructor(
    @Inject(CHAT_CLIENT_TOKEN) private readonly chatClient: ClientProxy,
    private readonly socketGateway: ChatSocketGateway,
  ) {}

  @Post('direct')
  @ApiOperation({ summary: 'Create or return existing direct chat with a user' })
  @ApiResponse({ status: 201, description: 'Chat object' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  createDirect(@CurrentUser() user: JwtPayload, @Body() dto: CreateDirectChatDto) {
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.CREATE_DIRECT, {
        userId: user.sub,
        targetUserId: dto.targetUserId,
      }),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all chats for current user' })
  @ApiResponse({ status: 200, description: 'Array of chat objects' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getChats(@CurrentUser() user: JwtPayload) {
    return this.send(this.chatClient.send(CHAT_PATTERNS.GET_CHATS, { userId: user.sub }));
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages for a chat (paginated)' })
  @ApiParam({ name: 'id', description: 'Chat UUID' })
  @ApiQuery({ name: 'skip', required: false, description: 'Number of messages to skip' })
  @ApiQuery({
    name: 'take',
    required: false,
    description: 'Number of messages to return (default 50)',
  })
  @ApiResponse({ status: 200, description: 'Array of message objects' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a member of this chat' })
  getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.GET_MESSAGES, {
        chatId,
        userId: user.sub,
        skip: skip ? parseInt(skip, 10) : undefined,
        take: take ? parseInt(take, 10) : undefined,
      }),
    );
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message to a chat' })
  @ApiParam({ name: 'id', description: 'Chat UUID' })
  @ApiResponse({ status: 201, description: 'Created message object' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a member of this chat' })
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.send(
      this.chatClient.send(CHAT_PATTERNS.SEND_MESSAGE, {
        chatId,
        senderId: user.sub,
        text: dto.text,
      }),
    );

    this.socketGateway.broadcastMessage(chatId, message);

    return message;
  }

  private async send<T>(observable: Observable<T>): Promise<T> {
    try {
      return await lastValueFrom(observable);
    } catch (err) {
      const error = err as { statusCode?: number; message?: string };
      throw new HttpException(error.message ?? 'Internal server error', error.statusCode ?? 500);
    }
  }
}
