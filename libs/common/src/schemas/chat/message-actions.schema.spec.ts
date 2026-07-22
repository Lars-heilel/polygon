import { API_ROUTES } from '../../constants/routes';
import { deleteMessageSchema } from './delete-message.schema';
import { editMessageSchema } from './edit-message.schema';
import { messageSchema } from './message.schema';

describe('message action schemas', () => {
  it('trims edited text and rejects empty edits', () => {
    expect(editMessageSchema.parse({ text: '  hello  ' })).toEqual({ text: 'hello' });
    expect(() => editMessageSchema.parse({ text: '   ' })).toThrow();
  });

  it('accepts only supported delete modes', () => {
    expect(deleteMessageSchema.parse({ mode: 'ME' })).toEqual({ mode: 'ME' });
    expect(deleteMessageSchema.parse({ mode: 'EVERYONE' })).toEqual({ mode: 'EVERYONE' });
    expect(() => deleteMessageSchema.parse({ mode: 'CHAT' })).toThrow();
  });

  it('includes edit and delete metadata on messages', () => {
    const createdAt = new Date('2026-07-22T00:00:00.000Z');
    expect(
      messageSchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        clientId: null,
        chatId: '22222222-2222-4222-8222-222222222222',
        senderId: '33333333-3333-4333-8333-333333333333',
        type: 'TEXT',
        text: 'hello',
        fileId: null,
        fileBucket: null,
        fileKey: null,
        fileName: null,
        fileSize: null,
        fileMime: null,
        fileCategory: null,
        forwardedFromId: null,
        forwardedFromSenderId: null,
        forwardedFromCreatedAt: null,
        forwardedFromType: null,
        forwardedFromText: null,
        forwardedFromFileName: null,
        editedAt: null,
        deletedAt: null,
        deletedById: null,
        createdAt,
        updatedAt: createdAt,
      }),
    ).toMatchObject({ editedAt: null, deletedAt: null, deletedById: null });
  });

  it('includes forwarded source metadata on messages', () => {
    const createdAt = new Date('2026-07-22T00:00:00.000Z');
    const forwardedFromCreatedAt = new Date('2026-07-21T10:15:00.000Z');

    expect(
      messageSchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        clientId: null,
        chatId: '22222222-2222-4222-8222-222222222222',
        senderId: '33333333-3333-4333-8333-333333333333',
        type: 'TEXT',
        text: 'forwarded text',
        fileId: null,
        fileBucket: null,
        fileKey: null,
        fileName: null,
        fileSize: null,
        fileMime: null,
        fileCategory: null,
        forwardedFromId: '44444444-4444-4444-8444-444444444444',
        forwardedFromSenderId: '55555555-5555-4555-8555-555555555555',
        forwardedFromCreatedAt,
        forwardedFromType: 'TEXT',
        forwardedFromText: 'source text snapshot',
        forwardedFromFileName: null,
        editedAt: null,
        deletedAt: null,
        deletedById: null,
        createdAt,
        updatedAt: createdAt,
      }),
    ).toMatchObject({
      forwardedFromSenderId: '55555555-5555-4555-8555-555555555555',
      forwardedFromCreatedAt,
      forwardedFromType: 'TEXT',
      forwardedFromText: 'source text snapshot',
      forwardedFromFileName: null,
    });
  });

  it('builds message action routes', () => {
    expect(API_ROUTES.chats.message('chat-1', 'msg-1')).toBe('chats/chat-1/messages/msg-1');
    expect(API_ROUTES.chats.forward('chat-1')).toBe('chats/chat-1/forward');
  });
});
