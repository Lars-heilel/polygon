import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Logger,
  Param,
  Patch,
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
  CreateDirectChatDto,
  DeleteMessageDto,
  EditMessageDto,
  MarkChatReadDto,
  SendMessageDto,
  type CloneForwardMessageInput,
  type PreparedForwardMessage,
} from '@org/chat';
import type { ForwardMessageInput, Message, MessagePage, UserPublic } from '@org/common';
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
  async getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ): Promise<MessagePage> {
    const page = await this.send<MessagePage>(
      this.chatClient.send(CHAT_PATTERNS.GET_MESSAGES, {
        chatId,
        userId: user.sub,
        cursor,
        take: take ? parseInt(take, 10) : undefined,
      }),
    );

    return {
      ...page,
      messages: await this.enrichForwardedMessages(page.messages),
    };
  }

  @Get(':id/media/messages')
  @ApiOperation({ summary: 'Get media and link messages for a chat' })
  @ApiParam({ name: 'id', description: 'Chat UUID' })
  @ApiQuery({ name: 'filter', required: false, description: 'ALL | IMAGE | VIDEO | AUDIO | FILE | LINK' })
  @ApiQuery({ name: 'cursor', required: false, description: 'ID of the last fetched message' })
  @ApiQuery({ name: 'take', required: false, description: 'Number of messages to return (default 50)' })
  async getMediaMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Query(new ZodValidationPipe()) query: unknown,
  ): Promise<MessagePage> {
    const parsed = chatMediaQuerySchema.parse(query);
    const page = await this.send<MessagePage>(
      this.chatClient.send(CHAT_PATTERNS.GET_MEDIA_MESSAGES, {
        chatId,
        userId: user.sub,
        cursor: parsed.cursor,
        take: parsed.take,
        filter: parsed.filter,
      }),
    );

    return {
      ...page,
      messages: await this.enrichForwardedMessages(page.messages),
    };
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
      hasClientId: !!dto.clientId,
      type: dto.type ?? 'TEXT',
      hasText: !!dto.text,
      hasFile: !!dto.fileId,
    });
    const message = await this.send(
      this.chatClient.send(CHAT_PATTERNS.SEND_MESSAGE, {
        chatId,
        clientId: dto.clientId ?? null,
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

  @Patch(':id/messages/:messageId')
  @ApiOperation({ summary: 'Edit a text-only message' })
  @ApiParam({ name: 'id', description: 'Chat UUID' })
  @ApiParam({ name: 'messageId', description: 'Message UUID' })
  async editMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    this.logger.debug({
      eventType: 'message_edit_requested',
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasUserId: !!user.sub,
    });
    const message = await this.send(
      this.chatClient.send(CHAT_PATTERNS.EDIT_MESSAGE, {
        chatId,
        messageId,
        userId: user.sub,
        text: dto.text,
      }),
    );
    this.socketGateway.broadcastMessageUpdated(chatId, message);
    return message;
  }

  @Delete(':id/messages/:messageId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a message for current user or everyone' })
  @ApiParam({ name: 'id', description: 'Chat UUID' })
  @ApiParam({ name: 'messageId', description: 'Message UUID' })
  async deleteMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: DeleteMessageDto,
  ) {
    this.logger.debug({
      eventType: 'message_delete_requested',
      hasChatId: !!chatId,
      hasMessageId: !!messageId,
      hasUserId: !!user.sub,
      mode: dto.mode,
    });
    const result = await this.send<{ id: string; chatId: string }>(
      this.chatClient.send(CHAT_PATTERNS.DELETE_MESSAGE, {
        chatId,
        messageId,
        userId: user.sub,
        mode: dto.mode,
      }),
    );

    if (dto.mode === 'EVERYONE') {
      this.socketGateway.broadcastMessageDeleted(chatId, messageId);
    } else {
      this.socketGateway.emitToUser(user.sub, 'message:hidden', { chatId, messageId });
    }

    return result;
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
    const sourceChatId = dto.sourceChatId ?? targetChatId;
    this.logger.log({
      eventType: 'message_forward_requested',
      hasTargetChatId: !!targetChatId,
      hasSourceChatId: !!sourceChatId,
      hasUserId: !!user.sub,
      messageCount: dto.messageIds.length,
    });

    try {
      const preparedMessages = await this.send<PreparedForwardMessage[]>(
        this.chatClient.send(CHAT_PATTERNS.PREPARE_FORWARD_MESSAGES, {
          sourceChatId,
          targetChatId,
          messageIds: dto.messageIds,
          userId: user.sub,
        }),
      );
      const cloneInputs = await this.enrichPreparedForwardMessages(preparedMessages);
      const messages = await this.send<Message[]>(
        this.chatClient.send(CHAT_PATTERNS.CLONE_FORWARD_MESSAGES, {
          targetChatId,
          userId: user.sub,
          messages: cloneInputs,
        }),
      );
      this.logger.log({
        eventType: 'message_forward_created',
        requestedCount: dto.messageIds.length,
        createdCount: messages.length,
      });

      for (const msg of messages) {
        this.socketGateway.broadcastMessage(targetChatId, msg);
      }

      this.logger.log({
        eventType: 'message_forward_broadcasted',
        createdCount: messages.length,
        hasTargetChatId: !!targetChatId,
      });

      return messages;
    } catch (error) {
      this.logger.warn({
        eventType: 'message_forward_failed',
        hasTargetChatId: !!targetChatId,
        hasSourceChatId: !!sourceChatId,
        hasUserId: !!user.sub,
        messageCount: dto.messageIds.length,
      });
      throw error;
    }
  }

  private async enrichPreparedForwardMessages(
    messages: PreparedForwardMessage[],
  ): Promise<CloneForwardMessageInput[]> {
    const originalAuthorIds = [...new Set(
      messages
        .map((message) => message.forwardContext?.originalAuthorId ?? message.senderId)
        .filter((id): id is string => Boolean(id)),
    )];

    if (originalAuthorIds.length === 0) {
      this.logger.debug({
        eventType: 'message_forward_author_snapshot_requested',
        messageCount: messages.length,
        authorCount: 0,
      });
      return [];
    }

    this.logger.debug({
      eventType: 'message_forward_author_snapshot_requested',
      messageCount: messages.length,
      authorCount: originalAuthorIds.length,
    });
    const profiles = await this.send<UserPublic[]>(
      this.userClient.send(USER_PATTERNS.GET_MANY_BY_IDS, { ids: originalAuthorIds }),
    );
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const missingCount = originalAuthorIds.filter((id) => !profileMap.has(id)).length;

    if (missingCount > 0) {
      this.logger.warn({
        eventType: 'message_forward_author_snapshot_missing',
        authorCount: originalAuthorIds.length,
        profileCount: profiles.length,
        missingCount,
      });
    }

    this.logger.debug({
      eventType: 'message_forward_author_snapshot_completed',
      messageCount: messages.length,
      authorCount: originalAuthorIds.length,
      profileCount: profiles.length,
      missingCount,
    });

    return messages.map((message) => ({
      ...message,
      originalAuthorId: message.forwardContext?.originalAuthorId ?? message.senderId,
      originalAuthorNameSnapshot: profileMap.get(
        message.forwardContext?.originalAuthorId ?? message.senderId,
      )?.name ?? 'Deleted user',
      originalAuthorDisplayNameSnapshot: profileMap.get(
        message.forwardContext?.originalAuthorId ?? message.senderId,
      )?.displayName ?? null,
    }));
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
