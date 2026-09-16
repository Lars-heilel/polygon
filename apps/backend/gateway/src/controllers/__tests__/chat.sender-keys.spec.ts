import { HttpException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common/enums';
import type { ClientProxy } from '@nestjs/microservices';
import { CHAT_PATTERNS } from '@org/core';
import { type Observable, of } from 'rxjs';

import { ChatGatewayController } from '../chat.controller';

describe('ChatGatewayController sender-key distribution', () => {
  function setup() {
    const chatClient = {
      send: jest.fn<Observable<unknown>, [string, unknown?]>(() => of({ ok: true })),
    };
    const controller = new ChatGatewayController(
      chatClient as unknown as ClientProxy,
      { send: jest.fn(() => of([])) } as unknown as ClientProxy,
      {} as never,
      {} as never,
    );
    return { chatClient, controller };
  }

  const DEVICE_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1';
  const CHAT_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2';

  it('routes GET /chats to getChats', () => {
    const method = Reflect.getMetadata(METHOD_METADATA, ChatGatewayController.prototype.getChats);
    const path = Reflect.getMetadata(PATH_METADATA, ChatGatewayController.prototype.getChats);
    expect(method).toBe(RequestMethod.GET);
    expect(path).toBe('/');
  });

  it('publishes prekeys by proxying PREKEYS_PUBLISH for the device owner', async () => {
    const { chatClient, controller } = setup();
    chatClient.send.mockReturnValueOnce(
      of({ deviceId: DEVICE_ID, userId: 'user-1', identityKey: 'aWtlaQ==', registrationId: 7 }),
    );
    const dto = {
      deviceId: DEVICE_ID,
      signedPrekey: 'c3Bn',
      signedPrekeySignature: 'c2ln',
      oneTimePrekeys: ['b3Rw'],
    };

    await controller.publishPrekeys({ sub: 'user-1' } as never, DEVICE_ID, dto as never);

    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.DEVICE_GET, {
      deviceId: DEVICE_ID,
    });
    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.PREKEYS_PUBLISH, dto);
  });

  it('rejects prekey publish for a foreign device with 403 and no PREKEYS_PUBLISH call', async () => {
    const { chatClient, controller } = setup();
    chatClient.send.mockReturnValueOnce(
      of({ deviceId: DEVICE_ID, userId: 'user-2', identityKey: 'aWtlaQ==', registrationId: 7 }),
    );
    const dto = {
      deviceId: DEVICE_ID,
      signedPrekey: 'c3Bn',
      signedPrekeySignature: 'c2ln',
      oneTimePrekeys: ['b3Rw'],
    };

    await expect(
      controller.publishPrekeys({ sub: 'user-1' } as never, DEVICE_ID, dto as never),
    ).rejects.toBeInstanceOf(HttpException);

    const publishCalls = chatClient.send.mock.calls.filter(
      ([pattern]) => pattern === CHAT_PATTERNS.PREKEYS_PUBLISH,
    );
    expect(publishCalls).toHaveLength(0);
  });

  it('rejects prekey publish for an unknown device with 403 and no PREKEYS_PUBLISH call', async () => {
    const { chatClient, controller } = setup();
    chatClient.send.mockReturnValueOnce(of(null));
    const dto = {
      deviceId: DEVICE_ID,
      signedPrekey: 'c3Bn',
      signedPrekeySignature: 'c2ln',
      oneTimePrekeys: ['b3Rw'],
    };

    await expect(
      controller.publishPrekeys({ sub: 'user-1' } as never, DEVICE_ID, dto as never),
    ).rejects.toMatchObject({ status: 403 });

    const publishCalls = chatClient.send.mock.calls.filter(
      ([pattern]) => pattern === CHAT_PATTERNS.PREKEYS_PUBLISH,
    );
    expect(publishCalls).toHaveLength(0);
  });

  it('distributes a sender-key share by proxying SENDER_KEY_DISTRIBUTE', async () => {
    const { chatClient, controller } = setup();
    chatClient.send.mockReturnValueOnce(of(true)).mockReturnValueOnce(of({ ok: true }));
    const share = {
      chatId: CHAT_ID,
      chainKeyId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c3',
      senderDeviceId: DEVICE_ID,
      recipientDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c4',
      wrappedChainKey: 'd3JhcHBlZA==',
    };

    await controller.distributeSenderKey({ sub: 'user-1' } as never, CHAT_ID, share as never);

    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
      chatId: share.chatId,
      userId: 'user-1',
    });
    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.SENDER_KEY_DISTRIBUTE, share);
  });

  it('normalizes a mismatched body chatId to the URL chat id', async () => {
    const { chatClient, controller } = setup();
    chatClient.send.mockReturnValueOnce(of(true)).mockReturnValueOnce(of({ ok: true }));
    const share = {
      chatId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c9',
      chainKeyId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c3',
      senderDeviceId: DEVICE_ID,
      recipientDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c4',
      wrappedChainKey: 'd3JhcHBlZA==',
    };

    await controller.distributeSenderKey({ sub: 'user-1' } as never, CHAT_ID, share as never);

    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.SENDER_KEY_DISTRIBUTE, {
      ...share,
      chatId: CHAT_ID,
    });
  });

  it('registers a device for a fresh device id', async () => {
    const { chatClient, controller } = setup();
    chatClient.send.mockReturnValueOnce(of(null)).mockReturnValueOnce(of({ ok: true }));
    const dto = { deviceId: DEVICE_ID, identityKey: 'aWtlaQ==', registrationId: 7 };

    await controller.registerDevice({ sub: 'user-1' } as never, dto as never);

    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.DEVICE_GET, {
      deviceId: DEVICE_ID,
    });
    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.DEVICE_REGISTER, {
      userId: 'user-1',
      ...dto,
    });
  });

  it('rejects device registration for a foreign device with 403 and no DEVICE_REGISTER call', async () => {
    const { chatClient, controller } = setup();
    chatClient.send.mockReturnValueOnce(
      of({ deviceId: DEVICE_ID, userId: 'user-2', identityKey: 'aWtlaQ==', registrationId: 7 }),
    );
    const dto = { deviceId: DEVICE_ID, identityKey: 'aWtlaQ==', registrationId: 7 };

    await expect(
      controller.registerDevice({ sub: 'user-1' } as never, dto as never),
    ).rejects.toMatchObject({ status: 403 });

    const registerCalls = chatClient.send.mock.calls.filter(
      ([pattern]) => pattern === CHAT_PATTERNS.DEVICE_REGISTER,
    );
    expect(registerCalls).toHaveLength(0);
  });

  it('revokes a device owned by the caller', async () => {
    const { chatClient, controller } = setup();
    chatClient.send
      .mockReturnValueOnce(
        of({ deviceId: DEVICE_ID, userId: 'user-1', identityKey: 'aWtlaQ==', registrationId: 7 }),
      )
      .mockReturnValueOnce(of({ ok: true }));

    await controller.revokeDevice({ sub: 'user-1' } as never, DEVICE_ID);

    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.DEVICE_REVOKE, {
      deviceId: DEVICE_ID,
      userId: 'user-1',
    });
  });

  it('rejects device revocation for a foreign device with 403 and no DEVICE_REVOKE call', async () => {
    const { chatClient, controller } = setup();
    chatClient.send.mockReturnValueOnce(
      of({ deviceId: DEVICE_ID, userId: 'user-2', identityKey: 'aWtlaQ==', registrationId: 7 }),
    );

    await expect(
      controller.revokeDevice({ sub: 'user-1' } as never, DEVICE_ID),
    ).rejects.toMatchObject({ status: 403 });

    const revokeCalls = chatClient.send.mock.calls.filter(
      ([pattern]) => pattern === CHAT_PATTERNS.DEVICE_REVOKE,
    );
    expect(revokeCalls).toHaveLength(0);
  });

  it('rejects device revocation for an unknown device with 403 and no DEVICE_REVOKE call', async () => {
    const { chatClient, controller } = setup();
    chatClient.send.mockReturnValueOnce(of(null));

    await expect(
      controller.revokeDevice({ sub: 'user-1' } as never, DEVICE_ID),
    ).rejects.toMatchObject({ status: 403 });

    const revokeCalls = chatClient.send.mock.calls.filter(
      ([pattern]) => pattern === CHAT_PATTERNS.DEVICE_REVOKE,
    );
    expect(revokeCalls).toHaveLength(0);
  });

  it('rotates the sender-key chain for a chat admin', async () => {
    const { chatClient, controller } = setup();
    chatClient.send
      .mockReturnValueOnce(of(true))
      .mockReturnValueOnce(of([{ userId: 'user-1', role: 'ADMIN' }]))
      .mockReturnValueOnce(of({ chainKeyId: 'new-chain' }));

    await controller.rotateSenderKey({ sub: 'user-1' } as never, CHAT_ID, {} as never);

    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
      chatId: CHAT_ID,
      userId: 'user-1',
    });
    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.SENDER_KEY_ROTATE, {
      chatId: CHAT_ID,
      removedDeviceIds: [],
    });
  });

  it('rejects rotation for a non-admin member with 403 and no SENDER_KEY_ROTATE call', async () => {
    const { chatClient, controller } = setup();
    chatClient.send
      .mockReturnValueOnce(of(true))
      .mockReturnValueOnce(of([{ userId: 'user-1', role: 'MEMBER' }]));

    await expect(
      controller.rotateSenderKey({ sub: 'user-1' } as never, CHAT_ID, {} as never),
    ).rejects.toMatchObject({ status: 403 });

    const rotateCalls = chatClient.send.mock.calls.filter(
      ([pattern]) => pattern === CHAT_PATTERNS.SENDER_KEY_ROTATE,
    );
    expect(rotateCalls).toHaveLength(0);
  });

  it('rejects rotation for a non-member with 403 and no SENDER_KEY_ROTATE call', async () => {
    const { chatClient, controller } = setup();
    chatClient.send.mockReturnValueOnce(of(false));

    await expect(
      controller.rotateSenderKey({ sub: 'user-1' } as never, CHAT_ID, {} as never),
    ).rejects.toMatchObject({ status: 403 });

    const rotateCalls = chatClient.send.mock.calls.filter(
      ([pattern]) => pattern === CHAT_PATTERNS.SENDER_KEY_ROTATE,
    );
    expect(rotateCalls).toHaveLength(0);
  });
});
