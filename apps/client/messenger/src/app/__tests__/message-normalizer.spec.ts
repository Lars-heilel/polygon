import { normalizeMessage, normalizeMessagePage } from '@org/entities-message';
import type { RawMessage } from '@org/entities-message';

const baseRaw: RawMessage = {
  id: '11111111-1111-4111-8111-111111111111',
  clientId: null,
  chatId: '22222222-2222-4222-8222-222222222222',
  senderId: '33333333-3333-4333-8333-333333333333',
  type: 'TEXT',
  text: 'hello',
  editedAt: null,
  deletedAt: null,
  deletedById: null,
  createdAt: '2026-07-22T07:00:00.000Z',
  updatedAt: '2026-07-22T07:00:00.000Z',
  media: null,
  linkPreview: null,
};

describe('message normalization', () => {
  it('normalizes a legacy text message into the target shape', () => {
    const message = normalizeMessage(baseRaw);

    expect(message.kind).toBe('text');
    expect(message.media).toBeNull();
    expect(message.linkPreview).toBeNull();
    expect(message.localStatus).toBeUndefined();
  });

  it('normalizes an image attachment into message.media with stable content url', () => {
    const message = normalizeMessage({
      ...baseRaw,
      type: 'IMAGE',
      text: null,
      attachments: [{
        id: '55555555-5555-4555-8555-555555555555',
        messageId: baseRaw.id,
        mediaId: '44444444-4444-4444-8444-444444444444',
        fileNameSnapshot: 'photo.png',
        fileSizeSnapshot: 1024,
        mimeSnapshot: 'image/png',
        category: 'IMAGE',
        createdAt: '2026-07-22T10:00:00.000Z',
      }],
    });

    expect(message.kind).toBe('image');
    expect(message.media).toEqual(expect.objectContaining({
      fileId: '44444444-4444-4444-8444-444444444444',
      category: 'IMAGE',
      contentUrl: `/api/chats/${baseRaw.chatId}/messages/${baseRaw.id}/attachments/55555555-5555-4555-8555-555555555555/content`,
      width: null,
      height: null,
      durationMs: null,
      waveform: null,
    }));
  });

  it('builds media content urls from chat message attachment context', () => {
    const message = normalizeMessage({
      ...baseRaw,
      type: 'VOICE',
      text: null,
      attachments: [{
        id: '44444444-4444-4444-8444-444444444444',
        messageId: baseRaw.id,
        mediaId: '55555555-5555-4555-8555-555555555555',
        fileNameSnapshot: 'voice.ogg',
        fileSizeSnapshot: 33000,
        mimeSnapshot: 'audio/ogg',
        category: 'VOICE',
        createdAt: '2026-07-22T10:00:00.000Z',
      }],
    } as RawMessage);

    expect(message.kind).toBe('voice');
    expect(message.media?.contentUrl).toBe(
      `/api/chats/${baseRaw.chatId}/messages/${baseRaw.id}/attachments/44444444-4444-4444-8444-444444444444/content`,
    );
  });

  it('normalizes pages without changing pagination cursor semantics', () => {
    const page = normalizeMessagePage({ messages: [baseRaw], nextCursor: 'cursor-1' });

    expect(page.messages).toHaveLength(1);
    expect(page.nextCursor).toBe('cursor-1');
    expect(page.messages[0].kind).toBe('text');
  });

  it('preserves forwarded source context snapshots', () => {
    const message = normalizeMessage({
      ...baseRaw,
      forwardContext: {
        messageId: baseRaw.id,
        originalMessageId: '55555555-5555-4555-8555-555555555555',
        originalChatId: baseRaw.chatId,
        originalAuthorId: '66666666-6666-4666-8666-666666666666',
        originalAuthorNameSnapshot: 'Alice',
        originalAuthorDisplayNameSnapshot: 'Alice A.',
        originalMessageCreatedAt: '2026-07-21T10:15:00.000Z',
        originalMessageType: 'TEXT',
        originalTextPreview: 'source message snapshot',
        originalFileNamePreview: null,
        snapshotVersion: 1,
        createdAt: '2026-07-22T10:00:00.000Z',
      },
    });

    expect(message.forwardContext?.originalAuthor.displayNameSnapshot).toBe('Alice A.');
    expect(message.forwardContext?.originalMessageCreatedAt).toBe('2026-07-21T10:15:00.000Z');
    expect(message.forwardContext?.preview.text).toBe('source message snapshot');
  });
});
