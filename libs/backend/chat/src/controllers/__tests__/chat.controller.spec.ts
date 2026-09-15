import type {
  IChatService,
  IE2eeKeyService,
  ISenderKeyService,
} from '../../interfaces/chat.interface';
import { ChatController } from '../chat.controller';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

describe('ChatController', () => {
  let service: jest.Mocked<IChatService>;
  let e2eeKeyService: jest.Mocked<IE2eeKeyService>;
  let senderKeys: jest.Mocked<ISenderKeyService>;
  let controller: ChatController;

  beforeEach(() => {
    service = {
      createDirectChat: jest.fn(),
      getChats: jest.fn(),
      getMessages: jest.fn(),
      getMessagesDelta: jest.fn(),
      getMediaMessages: jest.fn(),
      sendMessage: jest.fn(),
      editMessage: jest.fn(),
      deleteMessage: jest.fn(),
      forwardMessages: jest.fn(),
      checkMembership: jest.fn(),
      getMembers: jest.fn(),
      getChatDevices: jest.fn(),
      createSelfChat: jest.fn(),
      markRead: jest.fn(),
      prepareForwardMessages: jest.fn(),
      cloneForwardMessages: jest.fn(),
      getMessageAttachmentForAccess: jest.fn(),
    };
    e2eeKeyService = {
      registerDevice: jest.fn(),
      revokeDevice: jest.fn(),
      publishPrekeys: jest.fn(),
      consumePrekeyBundle: jest.fn(),
    };
    senderKeys = {
      distributeShare: jest.fn(),
      distributeShares: jest.fn(),
      getShare: jest.fn(),
      rotateChain: jest.fn(),
      revokeShares: jest.fn(),
    };
    controller = new ChatController(service, e2eeKeyService, senderKeys);
  });

  it('delegates explicit self-chat creation to the service', async () => {
    const chat = { id: 'chat-self' };
    service.createSelfChat.mockResolvedValue(chat as never);

    await expect(controller.createSelf({ userId: 'user-1' })).resolves.toEqual(chat);

    expect(service.createSelfChat).toHaveBeenCalledWith('user-1');
  });

  it('delegates a read marker to the service', async () => {
    const member = { chatId: 'chat-1', userId: 'user-1' };
    service.markRead.mockResolvedValue(member as never);

    await expect(
      controller.markRead({ chatId: 'chat-1', userId: 'user-1', messageId: 'message-1' }),
    ).resolves.toEqual(member);

    expect(service.markRead).toHaveBeenCalledWith('chat-1', 'user-1', 'message-1');
  });

  it('delegates delta sync with the parsed query', async () => {
    const delta = { messages: [], deletedIds: ['101'] };
    service.getMessagesDelta.mockResolvedValue(delta as never);
    const query = { since: new Date('2026-09-13T00:00:00.000Z'), limit: 50 };

    await expect(
      controller.getMessagesDelta({ chatId: 'chat-1', userId: 'user-1', query }),
    ).resolves.toEqual(delta);
    expect(service.getMessagesDelta).toHaveBeenCalledWith('chat-1', 'user-1', query);
  });

  it('does not write raw RPC payloads to diagnostic logs', async () => {
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(controller, 'logger', { value: logger });
    service.sendMessage.mockResolvedValue({ id: 'message-1' } as never);
    service.markRead.mockResolvedValue({ chatId: 'chat-secret-id' } as never);

    await controller.sendMessage({
      chatId: 'chat-secret-id',
      senderId: 'user-secret-id',
      type: 'FILE',
      text: 'message text token=secret',
      fileName: 'file.png',
    });
    await controller.markRead({
      chatId: 'chat-secret-id',
      userId: 'user-secret-id',
      messageId: 'message-secret-id',
    });

    const diagnosticPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.error.mock.calls,
      logger.log.mock.calls,
      logger.warn.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain('user-secret-id');
    expect(diagnosticPayload).not.toContain('chat-secret-id');
    expect(diagnosticPayload).not.toContain('message text');
    expect(diagnosticPayload).not.toContain('file.png');
    expect(diagnosticPayload).not.toContain('token=secret');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'message_send_requested',
        hasChatId: true,
        hasSenderId: true,
      }),
    );
  });

  it('delegates attachment access to the service', async () => {
    service.getMessageAttachmentForAccess.mockResolvedValue({ mediaId: 'media-1' } as never);

    await expect(
      controller.getMessageAttachmentForAccess({
        chatId: 'chat-1',
        messageId: 'message-1',
        attachmentId: 'attachment-1',
        userId: 'user-1',
      }),
    ).resolves.toEqual({ mediaId: 'media-1' });

    expect(service.getMessageAttachmentForAccess).toHaveBeenCalledWith({
      chatId: 'chat-1',
      messageId: 'message-1',
      attachmentId: 'attachment-1',
      userId: 'user-1',
    });
  });

  it('delegates device registry and prekey operations to the e2ee key service', async () => {
    const device = {
      userId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c0',
      deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
      identityKey: 'aWtlaQ==',
      registrationId: 7,
    };
    e2eeKeyService.registerDevice.mockResolvedValue(device);
    e2eeKeyService.consumePrekeyBundle.mockResolvedValue({
      deviceId: device.deviceId,
      identityKey: device.identityKey,
      signedPrekey: 'c3Bn',
      signedPrekeySignature: 'c2ln',
      oneTimePrekey: 'b3Rw',
    });

    await expect(controller.registerDevice(device)).resolves.toEqual(device);
    expect(e2eeKeyService.registerDevice).toHaveBeenCalledWith(device);

    await controller.revokeDevice({ deviceId: device.deviceId });
    expect(e2eeKeyService.revokeDevice).toHaveBeenCalledWith(device.deviceId);

    const publish = {
      deviceId: device.deviceId,
      signedPrekey: 'c3Bn',
      signedPrekeySignature: 'c2ln',
      oneTimePrekeys: ['b3Rw'],
    };
    await controller.publishPrekeys(publish);
    expect(e2eeKeyService.publishPrekeys).toHaveBeenCalledWith(publish);

    await expect(controller.consumePrekeyBundle({ deviceId: device.deviceId })).resolves.toEqual(
      expect.objectContaining({ deviceId: device.deviceId, oneTimePrekey: 'b3Rw' }),
    );
  });
  it('delegates forward preparation and cloning to the service', async () => {
    service.prepareForwardMessages.mockResolvedValue([{ messageId: 'message-1' }] as never);
    service.cloneForwardMessages.mockResolvedValue([{ id: 'cloned-message' }] as never);

    await expect(
      controller.prepareForwardMessages({
        sourceChatId: 'source-chat',
        targetChatId: 'target-chat',
        messageIds: ['message-1'],
        userId: 'user-1',
      }),
    ).resolves.toEqual([{ messageId: 'message-1' }]);
    await expect(
      controller.cloneForwardMessages({
        targetChatId: 'target-chat',
        userId: 'user-1',
        messages: [{ messageId: 'message-1' } as never],
      }),
    ).resolves.toEqual([{ id: 'cloned-message' }]);

    expect(service.prepareForwardMessages).toHaveBeenCalledWith({
      sourceChatId: 'source-chat',
      targetChatId: 'target-chat',
      messageIds: ['message-1'],
      userId: 'user-1',
    });
    expect(service.cloneForwardMessages).toHaveBeenCalledWith({
      targetChatId: 'target-chat',
      userId: 'user-1',
      messages: [{ messageId: 'message-1' }],
    });
  });

  it('delegates chat device enumeration to the service', async () => {
    const devices = [{ deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1' }];
    service.getChatDevices.mockResolvedValue(devices as never);

    await expect(
      controller.getChatDevices({ chatId: 'chat-1', userId: 'user-1' }),
    ).resolves.toEqual(devices);
    expect(service.getChatDevices).toHaveBeenCalledWith('chat-1', 'user-1');
  });

  it('delegates sender-key distribution, rotation, and revocation', async () => {
    const share = {
      chatId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2',
      chainKeyId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c3',
      senderDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
      recipientDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c4',
      wrappedChainKey: 'd3JhcHBlZA==',
    };
    senderKeys.distributeShare.mockResolvedValue(share);
    senderKeys.rotateChain.mockResolvedValue({
      chainKeyId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c6',
    });
    senderKeys.revokeShares.mockResolvedValue(undefined);

    await expect(controller.distributeShare(share)).resolves.toEqual(share);
    expect(senderKeys.distributeShare).toHaveBeenCalledWith(share);

    await controller.rotateChain({
      chatId: share.chatId,
      removedDeviceIds: [share.recipientDeviceId],
    });
    expect(senderKeys.rotateChain).toHaveBeenCalledWith(share.chatId, [share.recipientDeviceId]);

    await controller.revokeShares({
      chatId: share.chatId,
      recipientDeviceId: share.recipientDeviceId,
    });
    expect(senderKeys.revokeShares).toHaveBeenCalledWith(share.chatId, share.recipientDeviceId);
  });
});
