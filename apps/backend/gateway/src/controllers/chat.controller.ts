import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Logger,
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
import { CreateDirectChatDto, MarkChatReadDto, SendMessageDto } from '@org/chat';
import type { ForwardMessageInput, MessagePage, UserPublic } from '@org/common';
import { chatMediaQuerySchema } from '@org/common';
import {
  CHAT_CLIENT_TOKEN,
  CHAT_PATTERNS,
  ActiveAccountGuard,
  CurrentUser,
  JwtGuard,
  type JwtPayload,
  USER_CLIENT_TOKEN,
  USER_PATTERNS,
} from '@org/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { Observable, lastValueFrom } from 'rxjs';

import { ChatSocketGateway } from '../gateways/chat.socket-gateway';

@ApiTags('chats')
@ApiCookieAuth('access_token')
@Controller('chats')
@UseGuards(JwtGuard, ActiveAccountGuard)
export class ChatGatewayController {
  private readonly logger = new Logger(ChatGatewayController.name);

  constructor(
    @Inject(CHAT_CLIENT_TOKEN) private readonly chatClient: ClientProxy,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
    private readonly socketGateway: ChatSocketGateway,
  ) {}

  @Post('direct')
  @ApiOperation({ summary: 'Create or return existing direct chat with a user' })
  @ApiResponse({ status: 201, description: 'Chat object' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  createDirect(@CurrentUser() user: JwtPayload, @Body() dto: CreateDirectChatDto) {
    this.logger.log({
      eventType: 'direct_chat_create_requested',
      hasUserId: !!user.sub,
      hasTargetUserId: !!dto.targetUserId,
    });
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.CREATE_DIRECT, {
        userId: user.sub,
        targetUserId: dto.targetUserId,
      }),
    );
  }

  @Post('self')
  createSelf(@CurrentUser() user: JwtPayload) {
    this.logger.log({ eventType: 'self_chat_create_requested', hasUserId: !!user.sub });
    return this.send(this.chatClient.send(CHAT_PATTERNS.CREATE_SELF, { userId: user.sub }));
  }

  @Get()
  @ApiOperation({ summary: 'Get all chats for current user' })
  @ApiResponse({ status: 200, description: 'Array of chat objects' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getChats(@CurrentUser() user: JwtPayload) {
    this.logger.log({ eventType: 'chat_list_requested', hasUserId: !!user.sub });
    const chats = await this.send<{ members: { userId: string }[] }[]>(
      this.chatClient.send(CHAT_PATTERNS.GET_CHATS, { userId: user.sub }),
    );

    const memberIds = [...new Set(chats.flatMap((c) => c.members.map((m) => m.userId)))];

    if (memberIds.length === 0) return chats;

    const profiles = await this.send<UserPublic[]>(
      this.userClient.send(USER_PATTERNS.GET_MANY_BY_IDS, { ids: memberIds }),
    );

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return chats.map((chat) => ({
      ...chat,
      members: chat.members.map((m) => ({
        ...m,
        profile: profileMap.get(m.userId) ?? null,
      })),
    }));
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages for a chat (cursor-paginated)' })
  @ApiParam({ name: 'id', description: 'Chat UUID' })
  @ApiQuery({ name: 'cursor', required: false, description: 'ID of the last fetched message' })
  @ApiQuery({
    name: 'take',
    required: false,
    description: 'Number of messages to return (default 50)',
  })
  @ApiResponse({ status: 200, description: '{ messages, nextCursor }' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a member of this chat' })
  getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.GET_MESSAGES, {
        chatId,
        userId: user.sub,
        cursor,
        take: take ? parseInt(take, 10) : undefined,
      }),
    );
  }

  @Get(':id/media/messages')
  @ApiOperation({ summary: 'Get media and link messages for a chat' })
  @ApiParam({ name: 'id', description: 'Chat UUID' })
  @ApiQuery({ name: 'filter', required: false, description: 'ALL | IMAGE | VIDEO | AUDIO | FILE | LINK' })
  @ApiQuery({ name: 'cursor', required: false, description: 'ID of the last fetched message' })
  @ApiQuery({ name: 'take', required: false, description: 'Number of messages to return (default 50)' })
  getMediaMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Query(new ZodValidationPipe()) query: unknown,
  ): Promise<MessagePage> {
    const parsed = chatMediaQuerySchema.parse(query);
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.GET_MEDIA_MESSAGES, {
        chatId,
        userId: user.sub,
        cursor: parsed.cursor,
        take: parsed.take,
        filter: parsed.filter,
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
    this.logger.debug({
      eventType: 'message_send_requested',
      hasChatId: !!chatId,
      hasUserId: !!user.sub,
      type: dto.type ?? 'TEXT',
      hasText: !!dto.text,
      hasFile: !!dto.fileId,
    });
    const message = await this.send(
      this.chatClient.send(CHAT_PATTERNS.SEND_MESSAGE, {
        chatId,
        senderId: user.sub,
        type: dto.type ?? 'TEXT',
        text: dto.text ?? null,
        fileId: dto.fileId ?? null,
        fileBucket: dto.fileBucket ?? null,
        fileKey: dto.fileKey ?? null,
        fileName: dto.fileName ?? null,
        fileSize: dto.fileSize ?? null,
        fileMime: dto.fileMime ?? null,
        fileCategory: dto.fileCategory ?? null,
      }),
    );

    this.socketGateway.broadcastMessage(chatId, message);
    await this.socketGateway.triggerPushForOfflineRecipients(chatId, user.sub, message);

    return message;
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Body() dto: MarkChatReadDto,
  ) {
    this.logger.debug({
      eventType: 'chat_read_mark_requested',
      hasChatId: !!chatId,
      hasUserId: !!user.sub,
      hasMessageId: !!dto.messageId,
    });
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.MARK_READ, {
        chatId,
        userId: user.sub,
        messageId: dto.messageId ?? null,
      }),
    );
  }

  @Post(':id/forward')
  @ApiOperation({ summary: 'Forward messages to a chat' })
  @ApiParam({ name: 'id', description: 'Target chat UUID' })
  @ApiResponse({ status: 201, description: 'Array of created messages' })
  async forwardMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id') targetChatId: string,
    @Body() dto: ForwardMessageInput,
  ) {
    const messages = await this.send<unknown[]>(
      this.chatClient.send(CHAT_PATTERNS.FORWARD_MESSAGES, {
        sourceChatId: dto.sourceChatId ?? targetChatId,
        targetChatId,
        messageIds: dto.messageIds,
        userId: user.sub,
      }),
    );

    for (const msg of messages) {
      this.socketGateway.broadcastMessage(targetChatId, msg);
    }

    return messages;
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
