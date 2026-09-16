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
  Put,
  Query,
  Res,
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
import { SessionGuard } from '@org/auth';
import {
  type CloneForwardMessageInput,
  CreateDirectChatDto,
  CreateSelfChatDto,
  DeleteMessageDto,
  DistributeSenderKeyDto,
  EditMessageDto,
  MarkChatReadDto,
  type PreparedForwardMessage,
  PublishPrekeysDto,
  RegisterDeviceDto,
  SendMessageDto,
} from '@org/chat';
import type {
  DeviceRecord,
  ForwardMessageInput,
  Message,
  MessagePage,
  UserPublic,
} from '@org/common';
import { API_ROUTES, chatMediaQuerySchema, messagesDeltaQuerySchema } from '@org/common';
import {
  ActiveAccountGuard,
  CHAT_CLIENT_TOKEN,
  CHAT_PATTERNS,
  CurrentUser,
  type JwtPayload,
  USER_CLIENT_TOKEN,
  USER_PATTERNS,
} from '@org/core';
import type { Response } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import { Observable, lastValueFrom } from 'rxjs';

import { GatewayChatCacheService } from '../cache/gateway-chat-cache.service';
import { ChatSocketGateway } from '../gateways/chat.socket-gateway';

@ApiTags('chats')
@ApiCookieAuth('access_token')
@Controller(API_ROUTES.chats.root)
@UseGuards(SessionGuard, ActiveAccountGuard)
export class ChatGatewayController {
  private readonly logger = new Logger(ChatGatewayController.name);

  constructor(
    @Inject(CHAT_CLIENT_TOKEN) private readonly chatClient: ClientProxy,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
    private readonly socketGateway: ChatSocketGateway,
    private readonly chatCache: GatewayChatCacheService,
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
      hasE2eeEnabled: dto.e2eeEnabled !== undefined,
    });
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.CREATE_DIRECT, {
        userId: user.sub,
        targetUserId: dto.targetUserId,
        ...(dto.e2eeEnabled !== undefined ? { e2eeEnabled: dto.e2eeEnabled } : {}),
      }),
    );
  }

  @Post('self')
  createSelf(@CurrentUser() user: JwtPayload, @Body() dto?: CreateSelfChatDto) {
    this.logger.log({
      eventType: 'self_chat_create_requested',
      hasUserId: !!user.sub,
      hasE2eeEnabled: dto?.e2eeEnabled !== undefined,
    });
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.CREATE_SELF, {
        userId: user.sub,
        ...(dto?.e2eeEnabled !== undefined ? { e2eeEnabled: dto.e2eeEnabled } : {}),
      }),
    );
  }

  @Post('devices')
  @ApiOperation({ summary: 'Register an E2EE device for the current user' })
  @ApiResponse({ status: 201, description: 'Device record' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async registerDevice(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    this.logger.log({
      eventType: 'device_register_requested',
      hasUserId: !!user.sub,
      hasDeviceId: !!dto.deviceId,
    });
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.DEVICE_REGISTER, {
        userId: user.sub,
        deviceId: dto.deviceId,
        identityKey: dto.identityKey,
        registrationId: dto.registrationId,
      }),
    );
  }

  @Delete('devices/:id')
  @ApiOperation({ summary: 'Revoke an E2EE device of the current user' })
  @ApiParam({ name: 'id', description: 'Device UUID' })
  @ApiResponse({ status: 200, description: 'Revocation result' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async revokeDevice(@CurrentUser() user: JwtPayload, @Param('id') deviceId: string) {
    this.logger.log({
      eventType: 'device_revoke_requested',
      hasUserId: !!user.sub,
      hasDeviceId: !!deviceId,
    });
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.DEVICE_REVOKE, {
        deviceId,
        userId: user.sub,
      }),
    );
  }

  @Get('devices/:id/prekeys')
  @ApiOperation({ summary: 'Consume a prekey bundle for a device (X3DH)' })
  @ApiParam({ name: 'id', description: 'Device UUID' })
  @ApiResponse({ status: 200, description: 'Prekey bundle or null' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async consumePrekeys(@CurrentUser() user: JwtPayload, @Param('id') deviceId: string) {
    this.logger.log({
      eventType: 'prekeys_consume_requested',
      hasUserId: !!user.sub,
      hasDeviceId: !!deviceId,
    });
    return this.send(this.chatClient.send(CHAT_PATTERNS.PREKEYS_CONSUME, { deviceId }));
  }

  @Get(':id/devices')
  @ApiOperation({ summary: 'List E2EE devices of chat members (sender-key distribution)' })
  @ApiParam({ name: 'id', description: 'Chat UUID' })
  @ApiResponse({ status: 200, description: 'Array of device records' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a member of this chat' })
  async getChatDevices(@CurrentUser() user: JwtPayload, @Param('id') chatId: string) {
    this.logger.log({
      eventType: 'chat_devices_requested',
      hasUserId: !!user.sub,
      hasChatId: !!chatId,
    });
    const isMember = await this.send<boolean>(
      this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
        chatId,
        userId: user.sub,
      }),
    );
    if (!isMember) {
      throw new HttpException('Not a member of this chat', 403);
    }
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.GET_CHAT_DEVICES, { chatId, userId: user.sub }),
    );
  }

  @Put('devices/:id/prekeys')
  @ApiOperation({ summary: 'Publish prekeys for a device (X3DH)' })
  @ApiParam({ name: 'id', description: 'Device UUID' })
  @ApiResponse({ status: 200, description: 'Publish result' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not the owner of this device' })
  async publishPrekeys(
    @CurrentUser() user: JwtPayload,
    @Param('id') deviceId: string,
    @Body() dto: PublishPrekeysDto,
  ) {
    this.logger.log({
      eventType: 'prekeys_publish_requested',
      hasUserId: !!user.sub,
      hasDeviceId: !!deviceId,
    });
    const device = await this.send<DeviceRecord | null>(
      this.chatClient.send(CHAT_PATTERNS.DEVICE_GET, { deviceId }),
    );
    if (!device || device.userId !== user.sub) {
      throw new HttpException('Not the owner of this device', 403);
    }
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.PREKEYS_PUBLISH, {
        deviceId,
        signedPrekey: dto.signedPrekey,
        signedPrekeySignature: dto.signedPrekeySignature,
        oneTimePrekeys: dto.oneTimePrekeys,
      }),
    );
  }

  @Post(':id/sender-keys')
  @ApiOperation({ summary: 'Distribute a sender-key share to a chat member device' })
  @ApiParam({ name: 'id', description: 'Chat UUID' })
  @ApiResponse({ status: 201, description: 'Stored share' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a member of this chat' })
  async distributeSenderKey(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Body() dto: DistributeSenderKeyDto,
  ) {
    this.logger.log({
      eventType: 'senderkey_distribute_requested',
      hasUserId: !!user.sub,
      hasChatId: !!chatId,
      hasRecipientDeviceId: !!dto.recipientDeviceId,
    });
    const isMember = await this.send<boolean>(
      this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
        chatId,
        userId: user.sub,
      }),
    );
    if (!isMember) {
      throw new HttpException('Not a member of this chat', 403);
    }
    // The URL `:id` is the source of truth — a mismatched body chatId must
    // not bypass the membership check above.
    return this.send(this.chatClient.send(CHAT_PATTERNS.SENDER_KEY_DISTRIBUTE, { ...dto, chatId }));
  }

  @Get()
  @ApiOperation({ summary: 'Get all chats for current user' })
  @ApiResponse({ status: 200, description: 'Array of chat objects' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getChats(@CurrentUser() user: JwtPayload, @Res({ passthrough: true }) res?: Response) {
    this.logger.log({ eventType: 'chat_list_requested', hasUserId: !!user.sub });
    const cached = await this.chatCache.getChatList(user.sub);
    if (cached) {
      this.logger.debug({ eventType: 'chat_list_cache_hit', hasUserId: !!user.sub });
      res?.setHeader('X-Cache', 'HIT');
      return cached;
    }
    const chats = await this.send<{ members: { userId: string }[] }[]>(
      this.chatClient.send(CHAT_PATTERNS.GET_CHATS, { userId: user.sub }),
    );

    const memberIds = [...new Set(chats.flatMap((c) => (c.members ?? []).map((m) => m.userId)))];

    if (memberIds.length === 0) {
      await this.chatCache.setChatList(user.sub, chats);
      res?.setHeader('X-Cache', 'MISS');
      return chats;
    }

    const profiles = await this.send<UserPublic[]>(
      this.userClient.send(USER_PATTERNS.GET_MANY_BY_IDS, { ids: memberIds }),
    );

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const enriched = chats.map((chat) => ({
      ...chat,
      members: (chat.members ?? []).map((m) => ({
        ...m,
        profile: profileMap.get(m.userId) ?? null,
      })),
    }));
    await this.chatCache.setChatList(user.sub, enriched);
    res?.setHeader('X-Cache', 'MISS');
    return enriched;
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
    @Res({ passthrough: true }) res?: Response,
  ): Promise<MessagePage> {
    const cacheCursor = cursor ?? 'HEAD';
    const takeNum = take ? parseInt(take, 10) : 50;
    const isMember = await this.send<boolean>(
      this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
        chatId,
        userId: user.sub,
      }),
    );
    if (!isMember) {
      throw new HttpException('Not a member of this chat', 403);
    }
    const cached = await this.chatCache.getMessagesPage(chatId, cacheCursor, user.sub, takeNum);
    if (cached) {
      this.logger.debug({ eventType: 'chat_messages_cache_hit', hasChatId: !!chatId });
      res?.setHeader('X-Cache', 'HIT');
      return cached;
    }
    const page = await this.send<MessagePage>(
      this.chatClient.send(CHAT_PATTERNS.GET_MESSAGES, {
        chatId,
        userId: user.sub,
        cursor,
        take: take ? parseInt(take, 10) : undefined,
      }),
    );

    const enriched: MessagePage = {
      ...page,
      messages: await this.enrichForwardedMessages(page.messages),
    };
    await this.chatCache.setMessagesPage(chatId, cacheCursor, enriched, 60, user.sub, takeNum);
    res?.setHeader('X-Cache', 'MISS');
    return enriched;
  }

  @Get(':id/messages/delta')
  @ApiOperation({ summary: 'Get changed messages since a checkpoint (delta sync)' })
  @ApiParam({ name: 'id', description: 'Chat UUID' })
  @ApiResponse({ status: 200, description: '{ messages, deletedIds }' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a member of this chat' })
  async getMessagesDelta(
    @CurrentUser() user: JwtPayload,
    @Param('id') chatId: string,
    @Query(new ZodValidationPipe()) query: unknown,
  ) {
    const parsed = messagesDeltaQuerySchema.parse(query);
    const isMember = await this.send<boolean>(
      this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
        chatId,
        userId: user.sub,
      }),
    );
    if (!isMember) {
      throw new HttpException('Not a member of this chat', 403);
    }
    return this.send(
      this.chatClient.send(CHAT_PATTERNS.GET_MESSAGES_DELTA, {
        chatId,
        userId: user.sub,
        query: parsed,
      }),
    );
  }

  @Get(':id/media/messages')
  @ApiOperation({ summary: 'Get media and link messages for a chat' })
  @ApiParam({ name: 'id', description: 'Chat UUID' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'ALL | IMAGE | VIDEO | AUDIO | FILE | LINK',
  })
  @ApiQuery({ name: 'cursor', required: false, description: 'ID of the last fetched message' })
  @ApiQuery({
    name: 'take',
    required: false,
    description: 'Number of messages to return (default 50)',
  })
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
      hasFile: !!dto.fileId || !!dto.attachments?.length,
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
        attachments: dto.attachments ?? [],
      }),
    );

    this.socketGateway.broadcastMessage(chatId, message);
    const memberIds = await this.socketGateway.triggerPushForOfflineRecipients(
      chatId,
      user.sub,
      message,
    );
    await this.invalidateChatForMembers(chatId, memberIds);

    return message;
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(
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
    const result = await this.send(
      this.chatClient.send(CHAT_PATTERNS.MARK_READ, {
        chatId,
        userId: user.sub,
        messageId: dto.messageId ?? null,
      }),
    );
    await this.invalidateChatForMembers(chatId);
    return result;
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
    await this.invalidateChatForMembers(chatId);
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

    await this.invalidateChatForMembers(chatId);
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

      await this.invalidateChatForMembers(targetChatId);
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

  private async invalidateChatForMembers(chatId: string, knownMemberIds?: string[]): Promise<void> {
    await this.chatCache.invalidateChatPages(chatId);
    let memberIds = knownMemberIds ?? [];
    if (!knownMemberIds || knownMemberIds.length === 0) {
      const members = await lastValueFrom(
        this.chatClient.send<{ userId: string }[]>(CHAT_PATTERNS.GET_MEMBERS, { chatId }),
      ).catch(() => [] as { userId: string }[]);
      memberIds = Array.isArray(members)
        ? members.filter((m) => typeof m.userId === 'string').map((m) => m.userId)
        : [];
    }
    for (const memberId of memberIds) {
      await this.chatCache.invalidateChatList(memberId);
    }
    this.logger.debug({
      eventType: 'chat_cache_invalidated',
      hasChatId: !!chatId,
      memberCount: memberIds.length,
    });
  }

  private async enrichPreparedForwardMessages(
    messages: PreparedForwardMessage[],
  ): Promise<CloneForwardMessageInput[]> {
    const originalAuthorIds = [
      ...new Set(
        messages
          .map((message) => message.forwardContext?.originalAuthorId ?? message.senderId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

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
      originalAuthorNameSnapshot:
        profileMap.get(message.forwardContext?.originalAuthorId ?? message.senderId)?.name ??
        'Deleted user',
      originalAuthorDisplayNameSnapshot:
        profileMap.get(message.forwardContext?.originalAuthorId ?? message.senderId)?.displayName ??
        null,
    }));
  }

  private async enrichForwardedMessages(messages: Message[]): Promise<Message[]> {
    const originalAuthorIds = [
      ...new Set(
        messages
          .map((message) => message.forwardContext?.originalAuthorId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (originalAuthorIds.length === 0) return messages;

    const profiles = await this.send<UserPublic[]>(
      this.userClient.send(USER_PATTERNS.GET_MANY_BY_IDS, { ids: originalAuthorIds }),
    );
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

    return messages.map((message) => {
      const context = message.forwardContext;
      if (!context) return message;

      const profile = profileMap.get(context.originalAuthorId);
      if (!profile) return message;

      return {
        ...message,
        forwardContext: {
          ...context,
          originalAuthorNameSnapshot: profile.name,
          originalAuthorDisplayNameSnapshot: profile.displayName,
        },
      };
    });
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
