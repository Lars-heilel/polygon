import { normalizeMessage, normalizeMessagePage } from '@org/entities-message';
import type { RawMessage } from '@org/entities-message';

const baseRaw: RawMessage = {
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
  forwardedFromSender: null,
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

  it('normalizes a legacy image file into message.media with stable content url', () => {
    const message = normalizeMessage({
      ...baseRaw,
      type: 'IMAGE',
      text: null,
      fileId: '44444444-4444-4444-8444-444444444444',
      fileName: 'photo.png',
      fileSize: 1024,
      fileMime: 'image/png',
      fileCategory: 'IMAGE',
    });

    expect(message.kind).toBe('image');
    expect(message.media).toEqual(expect.objectContaining({
      fileId: '44444444-4444-4444-8444-444444444444',
      category: 'IMAGE',
      contentUrl: '/api/media/files/44444444-4444-4444-8444-444444444444/content',
      width: null,
      height: null,
      durationMs: null,
      waveform: null,
    }));
  });

  it('normalizes pages without changing pagination cursor semantics', () => {
    const page = normalizeMessagePage({ messages: [baseRaw], nextCursor: 'cursor-1' });

    expect(page.messages).toHaveLength(1);
    expect(page.nextCursor).toBe('cursor-1');
    expect(page.messages[0].kind).toBe('text');
  });

  it('preserves forwarded source context and sender profile', () => {
    const message = normalizeMessage({
      ...baseRaw,
      forwardedFromId: '55555555-5555-4555-8555-555555555555',
      forwardedFromSenderId: '66666666-6666-4666-8666-666666666666',
      forwardedFromCreatedAt: '2026-07-21T10:15:00.000Z',
      forwardedFromType: 'TEXT',
      forwardedFromText: 'source message snapshot',
      forwardedFromFileName: null,
      forwardedFromSender: {
        id: '66666666-6666-4666-8666-666666666666',
        name: 'Alice',
        displayName: 'Alice A.',
        avatarUrl: null,
        bio: null,
      },
    });

    expect(message.forwardedFromSender?.displayName).toBe('Alice A.');
    expect(message.forwardedFromCreatedAt).toBe('2026-07-21T10:15:00.000Z');
    expect(message.forwardedFromText).toBe('source message snapshot');
  });
});
