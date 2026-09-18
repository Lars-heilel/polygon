import { uploadFileSchema } from '../upload-file.dto';

describe('uploadFileSchema', () => {
  const base = {
    originalName: 'photo.png',
    mimeType: 'image/png',
    size: 1024,
    category: 'IMAGE',
  } as const;

  it('accepts a matching mime/category pair', () => {
    expect(uploadFileSchema.parse(base).mimeType).toBe('image/png');
  });

  it('rejects a mismatched mime/category pair', () => {
    expect(() => uploadFileSchema.parse({ ...base, mimeType: 'application/octet-stream' })).toThrow(
      /MIME type does not match/,
    );
  });

  it('accepts the encrypted-upload shape: redacted name, real mime', () => {
    const parsed = uploadFileSchema.parse({
      originalName: 'encrypted-file',
      mimeType: 'image/png',
      size: 1040,
      category: 'IMAGE',
    });
    expect(parsed.originalName).toBe('encrypted-file');
  });

  it('rejects oversized uploads per category', () => {
    expect(() => uploadFileSchema.parse({ ...base, size: 21 * 1024 * 1024 })).toThrow(
      /File size exceeds/,
    );
  });
});
