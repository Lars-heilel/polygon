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

  it('publishes prekeys by proxying PREKEYS_PUBLISH', async () => {
    const { chatClient, controller } = setup();
    const dto = {
      deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
      signedPrekey: 'c3Bn',
      signedPrekeySignature: 'c2ln',
      oneTimePrekeys: ['b3Rw'],
    };

    await controller.publishPrekeys(
      { sub: 'user-1' } as never,
      '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
      dto as never,
    );

    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.PREKEYS_PUBLISH, dto);
  });

  it('distributes a sender-key share by proxying SENDER_KEY_DISTRIBUTE', async () => {
    const { chatClient, controller } = setup();
    chatClient.send.mockReturnValueOnce(of(true)).mockReturnValueOnce(of({ ok: true }));
    const share = {
      chatId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2',
      chainKeyId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c3',
      senderDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
      recipientDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c4',
      wrappedChainKey: 'd3JhcHBlZA==',
    };

    await controller.distributeSenderKey(
      { sub: 'user-1' } as never,
      '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2',
      share as never,
    );

    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
      chatId: share.chatId,
      userId: 'user-1',
    });
    expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.SENDER_KEY_DISTRIBUTE, share);
  });
});
