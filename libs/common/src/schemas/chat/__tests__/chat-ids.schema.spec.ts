import { chatSchema } from '../chat.schema';
import { forwardMessageSchema } from '../forward-message.schema';
import { messagesDeltaQuerySchema, messagesDeltaResponseSchema } from '../message-delta.schema';
import { messageSchema } from '../message.schema';
import { markChatReadSchema } from '../read-chat.schema';

const V7 = '0197f96c-b278-7f64-a32f-d44a57f6726b';

describe('chat decimal ids', () => {
  it('accepts a decimal message id', () => {
    expect(
      messageSchema.safeParse({
        id: '123456',
        clientId: null,
        chatId: V7,
        senderId: V7,
        type: 'TEXT',
        text: 'hi',
        hasLink: false,
        editedAt: null,
        deletedAt: null,
        deletedById: null,
        createdAt: new Date('2026-09-13T00:00:00.000Z'),
        updatedAt: new Date('2026-09-13T00:00:00.000Z'),
      }).success,
    ).toBe(true);
  });

  it('accepts decimal forward/delete/read ids', () => {
    expect(forwardMessageSchema.safeParse({ sourceChatId: V7, messageIds: ['42'] }).success).toBe(
      true,
    );
    expect(markChatReadSchema.safeParse({ messageId: '42' }).success).toBe(true);
  });

  it('accepts a directKey on chat', () => {
    const parsed = chatSchema.safeParse({
      id: V7,
      type: 'DIRECT',
      name: null,
      avatarUrl: null,
      selfOwnerId: V7,
      directKey: `direct:${V7}:${V7}`,
      lastMessageId: '42',
      lastMessageAt: new Date('2026-09-13T00:00:00.000Z'),
      createdAt: new Date('2026-09-13T00:00:00.000Z'),
      updatedAt: new Date('2026-09-13T00:00:00.000Z'),
    });
    expect(parsed.success).toBe(true);
  });

  it('validates the delta query and response', () => {
    expect(
      messagesDeltaQuerySchema.safeParse({ since: '2026-09-13T00:00:00.000Z', limit: 100 }).success,
    ).toBe(true);
    expect(
      messagesDeltaQuerySchema.safeParse({ since: '2026-09-13T00:00:00.000Z', limit: 101 }).success,
    ).toBe(false);
    expect(
      messagesDeltaResponseSchema.safeParse({ messages: [], deletedIds: ['42'] }).success,
    ).toBe(true);
  });
});
