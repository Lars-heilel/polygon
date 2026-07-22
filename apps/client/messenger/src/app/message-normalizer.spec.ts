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
});
