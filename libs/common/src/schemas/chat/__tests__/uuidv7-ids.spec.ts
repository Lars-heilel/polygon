import { chatSchema } from '../chat.schema';
import { messageSchema } from '../message.schema';

// UUIDv7 ids arrive from Prisma @default(uuid(7)) after the id migration.
// zod's z.uuid() accepts any version, and this spec pins that: narrowing to
// uuidv4 would reject every id generated after the migration.
const V7_ID = '0197f96c-b278-7f64-a32f-d44a57f6726b';
const V7_OTHER_ID = '0197f96d-1c3a-7e02-b7d1-9e8f0a1b2c3d';

describe('chat schemas accept UUIDv7 ids', () => {
  it('parses a chat with UUIDv7 ids', () => {
    const chat = chatSchema.parse({
      id: V7_ID,
      type: 'DIRECT',
      name: null,
      avatarUrl: null,
      selfOwnerId: V7_OTHER_ID,
      lastMessageId: null,
      lastMessageAt: null,
      createdAt: new Date('2026-09-12T00:00:00.000Z'),
      updatedAt: new Date('2026-09-12T00:00:00.000Z'),
    });

    expect(chat.id).toBe(V7_ID);
  });

  it('parses a message with UUIDv7 ids', () => {
    const message = messageSchema.parse({
      id: V7_ID,
      clientId: null,
      chatId: V7_OTHER_ID,
      senderId: V7_ID,
      type: 'TEXT',
      text: 'hi',
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      createdAt: new Date('2026-09-12T00:00:00.000Z'),
      updatedAt: new Date('2026-09-12T00:00:00.000Z'),
    });

    expect(message.id).toBe(V7_ID);
  });
});
