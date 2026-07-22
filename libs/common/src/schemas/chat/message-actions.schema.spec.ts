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

  it('accepts nested forward context and attachments on messages', () => {
    const createdAt = new Date('2026-07-22T10:00:00.000Z');

    const parsed = messageSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      clientId: null,
      chatId: '22222222-2222-4222-8222-222222222222',
      senderId: '33333333-3333-4333-8333-333333333333',
      type: 'AUDIO',
      text: null,
      attachments: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          messageId: '11111111-1111-4111-8111-111111111111',
          mediaId: '55555555-5555-4555-8555-555555555555',
          fileNameSnapshot: 'voice.ogg',
          fileSizeSnapshot: 33000,
          mimeSnapshot: 'audio/ogg',
          category: 'VOICE',
          createdAt,
        },
      ],
      forwardContext: {
        messageId: '11111111-1111-4111-8111-111111111111',
        originalMessageId: '66666666-6666-4666-8666-666666666666',
        originalChatId: '77777777-7777-4777-8777-777777777777',
        originalAuthorId: '88888888-8888-4888-8888-888888888888',
        originalAuthorNameSnapshot: 'tamilka',
        originalAuthorDisplayNameSnapshot: 'Тамилка:3',
        originalMessageCreatedAt: createdAt,
        originalMessageType: 'AUDIO',
        originalTextPreview: null,
        originalFileNamePreview: 'voice.ogg',
        snapshotVersion: 1,
        createdAt,
      },
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
    });

    expect(parsed.forwardContext?.originalAuthorDisplayNameSnapshot).toBe('Тамилка:3');
    expect(parsed.attachments[0].category).toBe('VOICE');
  });

  it('builds message action routes', () => {
    expect(API_ROUTES.chats.message('chat-1', 'msg-1')).toBe('chats/chat-1/messages/msg-1');
    expect(API_ROUTES.chats.forward('chat-1')).toBe('chats/chat-1/forward');
  });
});
