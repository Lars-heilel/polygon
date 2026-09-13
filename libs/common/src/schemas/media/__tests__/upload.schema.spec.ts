import { fileSchema } from '../file.schema';
import { confirmUploadSchema, initUploadSchema } from '../upload.schema';

describe('initUploadSchema', () => {
  const base = {
    originalName: 'photo.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    category: 'IMAGE' as const,
  };

  it('accepts a chat upload', () => {
    expect(
      initUploadSchema.safeParse({ ...base, chatId: '0197f96c-b278-7f64-a32f-d44a57f6726b' })
        .success,
    ).toBe(true);
  });

  it('rejects an overlong originalName', () => {
    expect(initUploadSchema.safeParse({ ...base, originalName: 'n'.repeat(256) }).success).toBe(
      false,
    );
  });

  it('rejects an overlong mimeType', () => {
    expect(initUploadSchema.safeParse({ ...base, mimeType: 'm'.repeat(128) }).success).toBe(
      false,
    );
  });

  it('rejects a non-positive size', () => {
    expect(initUploadSchema.safeParse({ ...base, size: 0 }).success).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(initUploadSchema.safeParse({ ...base, category: 'STICKER' }).success).toBe(false);
  });
});

describe('confirmUploadSchema', () => {
  it('accepts a uuid fileId', () => {
    expect(
      confirmUploadSchema.safeParse({ fileId: '0197f96c-b278-7f64-a32f-d44a57f6726b' }).success,
    ).toBe(true);
  });

  it('rejects a non-uuid fileId', () => {
    expect(confirmUploadSchema.safeParse({ fileId: 'nope' }).success).toBe(false);
  });
});

describe('fileSchema limits', () => {
  it('rejects bucket/key/originalName over limits', () => {
    const base = {
      id: '0197f96c-b278-7f64-a32f-d44a57f6726b',
      bucket: 'media',
      key: 'k',
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      url: null,
      uploaderId: null,
      status: 'READY' as const,
      chatId: null,
      category: 'IMAGE' as const,
      createdAt: new Date('2026-09-13T00:00:00.000Z'),
      updatedAt: new Date('2026-09-13T00:00:00.000Z'),
    };
    expect(fileSchema.safeParse({ ...base, bucket: 'b'.repeat(64) }).success).toBe(false);
    expect(fileSchema.safeParse({ ...base, originalName: 'n'.repeat(256) }).success).toBe(
      false,
    );
    expect(fileSchema.safeParse(base).success).toBe(true);
  });
});
