import type {
  Chat,
  ChatMediaFilter,
  ChatMember,
  ChatRole,
  ChatType,
  DeviceRecord,
  GroupMessageEnvelope,
  Message,
  MessageEnvelope,
  MessagePage,
  MessageType,
  MessagesDelta,
  MessagesDeltaQuery,
  PrekeyBundleRecord,
  PublishPrekeysInput,
  RegisterDeviceInput,
  SenderKeyDistribution,
} from '@org/common';

export type ChatWithPreview = Chat & {
  members: ChatMember[];
  lastMessage: Message | null;
  unreadCount: number;
};

export interface CreateMessageData {
  chatId: string;
  clientId?: string | null;
  senderId: string;
  type?: MessageType;
  text?: string | null;
  hasLink?: boolean;
}

export interface CreateMessageAttachmentData {
  mediaId: string;
  fileNameSnapshot?: string | null;
  fileSizeSnapshot?: number | null;
  mimeSnapshot?: string | null;
  category: string;
}

export interface CreateMessageForwardContextData {
  originalMessageId?: string | null;
  originalChatId?: string | null;
  originalAuthorId: string;
  originalAuthorNameSnapshot: string;
  originalAuthorDisplayNameSnapshot?: string | null;
  originalMessageCreatedAt: Date;
  originalMessageType: MessageType;
  originalTextPreview?: string | null;
  originalFileNamePreview?: string | null;
}

export type CreateMessageWithRelationsData = CreateMessageData & {
  attachments?: CreateMessageAttachmentData[];
  forwardContext?: CreateMessageForwardContextData | null;
};

export type SendMessageData = {
  clientId?: string | null;
  type: string;
  text?: string | null;
  /**
   * Opaque E2EE envelopes (per-device ciphertext). Not persisted to columns —
   * the message shell is stored with null text and the envelopes ride along
   * transiently for socket fan-out. No plaintext is visible server-side.
   */
  envelopes?: Array<GroupMessageEnvelope | MessageEnvelope> | null;
  attachments?: CreateMessageAttachmentData[];
  fileId?: string | null;
  fileBucket?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileMime?: string | null;
  fileCategory?: string | null;
};

export interface ForwardMessagesData {
  sourceChatId: string;
  targetChatId: string;
  messageIds: string[];
  userId: string;
}

export interface PreparedForwardMessage {
  messageId: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  text: string | null;
  createdAt: Date;
  attachments: CreateMessageAttachmentData[];
  forwardContext: CreateMessageForwardContextData | null;
}

export type CloneForwardMessageInput = PreparedForwardMessage & {
  originalAuthorId: string;
  originalAuthorNameSnapshot: string;
  originalAuthorDisplayNameSnapshot: string | null;
};

export interface CloneForwardMessagesData {
  targetChatId: string;
  userId: string;
  messages: CloneForwardMessageInput[];
}

export interface MessageAttachmentAccessInput {
  chatId: string;
  messageId: string;
  attachmentId: string;
  userId: string;
}

export interface SignedPrekeyPair {
  signedPrekey: string;
  signedPrekeySignature: string;
}

export interface IE2eeKeyRepository {
  upsertDevice(input: RegisterDeviceInput): Promise<DeviceRecord>;
  findDevice(deviceId: string): Promise<DeviceRecord | null>;
  findDevicesByUserIds(userIds: string[]): Promise<DeviceRecord[]>;
  deleteDevice(deviceId: string): Promise<void>;
  saveSignedPrekey(
    deviceId: string,
    signedPrekey: string,
    signedPrekeySignature: string,
  ): Promise<void>;
  findSignedPrekey(deviceId: string): Promise<SignedPrekeyPair | null>;
  addOneTimePrekeys(deviceId: string, prekeys: string[]): Promise<void>;
  consumeOneTimePrekey(deviceId: string): Promise<string | null>;
}

export interface IE2eeKeyService {
  registerDevice(input: RegisterDeviceInput): Promise<DeviceRecord>;
  revokeDevice(deviceId: string): Promise<{ revoked: boolean }>;
  getDevice(deviceId: string): Promise<DeviceRecord | null>;
  publishPrekeys(input: PublishPrekeysInput): Promise<{ published: number }>;
  consumePrekeyBundle(deviceId: string): Promise<PrekeyBundleRecord | null>;
}

export type SenderKeyShareRecord = SenderKeyDistribution & {
  revoked: boolean;
};

export interface ISenderKeyRepository {
  upsertShare(input: SenderKeyDistribution): Promise<SenderKeyShareRecord>;
  findShare(
    chatId: string,
    chainKeyId: string,
    recipientDeviceId: string,
  ): Promise<SenderKeyShareRecord | null>;
  findLatestChainId(chatId: string, senderDeviceId: string): Promise<string | null>;
  revokeShares(chatId: string, recipientDeviceIds: string[]): Promise<void>;
}

export interface ISenderKeyService {
  distributeShare(input: SenderKeyDistribution): Promise<SenderKeyDistribution>;
  distributeShares(inputs: SenderKeyDistribution[]): Promise<SenderKeyDistribution[]>;
  getShare(
    chatId: string,
    chainKeyId: string,
    recipientDeviceId: string,
  ): Promise<SenderKeyShareRecord | null>;
  getLatestChainId(chatId: string, senderDeviceId: string): Promise<string | null>;
  rotateChain(chatId: string, removedDeviceIds?: string[]): Promise<{ chainKeyId: string }>;
  revokeShares(chatId: string, recipientDeviceId: string): Promise<void>;
}

export interface IChatRepository {
  findChatById(id: string): Promise<Chat | null>;
  findDirectChatBetween(userId1: string, userId2: string): Promise<Chat | null>;
  findDirectChatByKey(directKey: string): Promise<Chat | null>;
  findSelfChat(userId: string): Promise<Chat | null>;
  createSelfChat(userId: string, e2eeEnabled?: boolean): Promise<Chat>;
  findChatsForUser(userId: string): Promise<ChatWithPreview[]>;
  createChat(data: {
    type: ChatType;
    name?: string | null;
    avatarUrl?: string | null;
    selfOwnerId?: string | null;
    directKey?: string | null;
    e2eeEnabled?: boolean;
  }): Promise<Chat>;
  deleteChat(id: string): Promise<void>;
  findChatMember(chatId: string, userId: string): Promise<ChatMember | null>;
  findMembersByChat(chatId: string): Promise<ChatMember[]>;
  addChatMember(data: { chatId: string; userId: string; role?: ChatRole }): Promise<ChatMember>;
  removeChatMember(chatId: string, userId: string): Promise<void>;
  findMessagesByChat(
    chatId: string,
    cursor: string | undefined,
    take: number,
    userId: string,
  ): Promise<MessagePage>;
  findMediaMessagesByChat(
    chatId: string,
    cursor: string | undefined,
    take: number,
    filter: ChatMediaFilter,
    userId: string,
  ): Promise<MessagePage>;
  findMessageById(id: string): Promise<Message | null>;
  findMessageByClientId(chatId: string, clientId: string): Promise<Message | null>;
  findMessagesDelta(
    chatId: string,
    userId: string,
    since: Date,
    sinceId: string | null,
    take: number,
  ): Promise<{ messages: Message[]; deletedIds: string[] }>;
  findVisibleMessagesByIds(
    chatId: string,
    messageIds: string[],
    userId: string,
  ): Promise<Message[]>;
  findMessageAttachmentForAccess(
    input: MessageAttachmentAccessInput,
  ): Promise<{ mediaId: string } | null>;
  createMessageWithRelations(data: CreateMessageWithRelationsData): Promise<Message>;
  createMessageWithTouch(data: CreateMessageWithRelationsData): Promise<Message>;
  createMessageEnvelopes(
    rows: { messageId: string; recipientDeviceId: string; envelopeJson: string }[],
  ): Promise<void>;
  findEnvelopesForMessages(
    messageIds: string[],
    recipientDeviceIds: string[],
  ): Promise<{ messageId: string; recipientDeviceId: string; envelopeJson: string }[]>;
  touchChatLastMessage(chatId: string, messageId: string, at: Date): Promise<void>;
  deleteCreatedMessage(messageId: string): Promise<void>;
  updateMessageText(messageId: string, text: string, hasLink: boolean): Promise<Message>;
  deleteMessageForEveryone(messageId: string, userId: string): Promise<Message>;
  hideMessageForUser(messageId: string, userId: string): Promise<void>;
  countUnreadMessages(
    chatId: string,
    userId: string,
    lastReadAt?: Date | null,
    lastReadMessageId?: string | null,
  ): Promise<number>;
  markChatRead(chatId: string, userId: string, messageId?: string | null): Promise<ChatMember>;
}

export interface IChatService {
  createDirectChat(userId: string, targetUserId: string, e2eeEnabled?: boolean): Promise<Chat>;
  createSelfChat(userId: string, e2eeEnabled?: boolean): Promise<Chat>;
  getChats(userId: string): Promise<ChatWithPreview[]>;
  getMessages(
    chatId: string,
    userId: string,
    cursor: string | undefined,
    take: number,
  ): Promise<MessagePage>;
  getMessagesDelta(
    chatId: string,
    userId: string,
    query: MessagesDeltaQuery,
  ): Promise<MessagesDelta>;
  getMediaMessages(
    chatId: string,
    userId: string,
    cursor: string | undefined,
    take: number,
    filter: ChatMediaFilter,
  ): Promise<MessagePage>;
  sendMessage(chatId: string, senderId: string, input: SendMessageData): Promise<Message>;
  editMessage(chatId: string, messageId: string, userId: string, text: string): Promise<Message>;
  deleteMessage(
    chatId: string,
    messageId: string,
    userId: string,
    mode: 'ME' | 'EVERYONE',
  ): Promise<Message | { id: string; chatId: string }>;
  forwardMessages(data: ForwardMessagesData): Promise<Message[]>;
  prepareForwardMessages(data: ForwardMessagesData): Promise<PreparedForwardMessage[]>;
  cloneForwardMessages(data: CloneForwardMessagesData): Promise<Message[]>;
  markRead(chatId: string, userId: string, messageId?: string | null): Promise<ChatMember>;
  checkMembership(chatId: string, userId: string): Promise<boolean>;
  getMembers(chatId: string): Promise<{ userId: string; role: ChatRole }[]>;
  getChatDevices(chatId: string, userId: string): Promise<DeviceRecord[]>;
  getMessageAttachmentForAccess(input: MessageAttachmentAccessInput): Promise<{ mediaId: string }>;
}

export interface IChatController {
  createDirect(payload: {
    userId: string;
    targetUserId: string;
    e2eeEnabled?: boolean;
  }): Promise<Chat>;
  createSelf(payload: { userId: string; e2eeEnabled?: boolean }): Promise<Chat>;
  getChats(payload: { userId: string }): Promise<ChatWithPreview[]>;
  getMessages(payload: {
    chatId: string;
    userId: string;
    cursor?: string;
    take?: number;
  }): Promise<MessagePage>;
  getMessagesDelta(payload: {
    chatId: string;
    userId: string;
    query: MessagesDeltaQuery;
  }): Promise<MessagesDelta>;
  getMediaMessages(payload: {
    chatId: string;
    userId: string;
    cursor?: string;
    take?: number;
    filter: ChatMediaFilter;
  }): Promise<MessagePage>;
  sendMessage(
    payload: {
      chatId: string;
      senderId: string;
    } & SendMessageData,
  ): Promise<Message>;
  forwardMessages(payload: ForwardMessagesData): Promise<Message[]>;
  prepareForwardMessages(payload: ForwardMessagesData): Promise<PreparedForwardMessage[]>;
  cloneForwardMessages(payload: CloneForwardMessagesData): Promise<Message[]>;
  markRead(payload: {
    chatId: string;
    userId: string;
    messageId?: string | null;
  }): Promise<ChatMember>;
  checkMembership(payload: { chatId: string; userId: string }): Promise<boolean>;
  getMembers(payload: { chatId: string }): Promise<{ userId: string; role: ChatRole }[]>;
  getChatDevices(payload: { chatId: string; userId: string }): Promise<DeviceRecord[]>;
  getMessageAttachmentForAccess(input: MessageAttachmentAccessInput): Promise<{ mediaId: string }>;
}

export interface ISenderKeyController {
  distributeShare(payload: SenderKeyDistribution): Promise<SenderKeyDistribution>;
  rotateChain(payload: {
    chatId: string;
    removedDeviceIds?: string[];
  }): Promise<{ chainKeyId: string }>;
  revokeShares(payload: { chatId: string; recipientDeviceId: string }): Promise<void>;
}
