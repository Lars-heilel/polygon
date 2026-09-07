import { CHAT_SELECT_FIELDS } from './chat-select';
import { chatSchema } from './chat.schema';

describe('chat schema', () => {
  it('exposes selfOwnerId for self chat detection', () => {
    const chat = chatSchema.parse({
      id: '00000000-0000-4000-8000-000000000001',
      type: 'DIRECT',
      name: 'Личное',
      avatarUrl: null,
      selfOwnerId: '00000000-0000-4000-8000-000000000002',
      lastMessageId: null,
      lastMessageAt: null,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
    });

    expect(chat.selfOwnerId).toBe('00000000-0000-4000-8000-000000000002');
    expect(CHAT_SELECT_FIELDS.selfOwnerId).toBe(true);
  });
});
