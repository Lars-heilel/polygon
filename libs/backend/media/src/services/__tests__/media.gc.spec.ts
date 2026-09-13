import { NotFoundException } from '@nestjs/common';
import type { IStorageProvider } from '@org/core';

import type { IMediaRepository } from '../../interfaces/media.interface';
import { MediaService } from '../media.service';

jest.mock('@org/core', () => ({
  MEDIA_PRISMA_REPOSITORY_TOKEN: Symbol('MEDIA_PRISMA_REPOSITORY_TOKEN'),
  STORAGE_PROVIDER_TOKEN: Symbol('STORAGE_PROVIDER_TOKEN'),
}));

const file = (overrides = {}) => ({
  id: 'file-1',
  url: null,
  bucket: 'media',
  key: 'images/1.jpg',
  originalName: '1.jpg',
  mimeType: 'image/jpeg',
  size: 1024,
  category: 'IMAGE',
  uploaderId: 'user-1',
  chatId: null,
  createdAt: new Date('2026-09-13T00:00:00.000Z'),
  ...overrides,
});

describe('MediaService not-found contract', () => {
  let repo: { findById: jest.Mock };
  let service: MediaService;

  beforeEach(() => {
    repo = { findById: jest.fn() };
    const storage = { delete: jest.fn() };
    service = new MediaService(
      repo as unknown as IMediaRepository,
      storage as unknown as IStorageProvider,
    );
  });

  it('confirmUpload throws 404 for a missing file', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.confirmUpload('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getFileContent throws 404 for a missing file', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.getFileContent('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MediaService gcStalePending', () => {
  it('deletes stale PENDING files from storage and metadata', async () => {
    const repo = {
      listStalePending: jest.fn().mockResolvedValue([file(), file({ id: 'file-2' })]),
      delete: jest.fn(),
    };
    const storage = { delete: jest.fn() };
    const service = new MediaService(
      repo as unknown as IMediaRepository,
      storage as unknown as IStorageProvider,
    );
    await expect(service.gcStalePending(24, 100)).resolves.toEqual({ deleted: 2, failed: 0 });
    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(repo.delete).toHaveBeenCalledTimes(2);
  });

  it('counts storage failures without stopping the batch', async () => {
    const repo = { listStalePending: jest.fn().mockResolvedValue([file()]), delete: jest.fn() };
    const storage = { delete: jest.fn().mockRejectedValue(new Error('minio down')) };
    const service = new MediaService(
      repo as unknown as IMediaRepository,
      storage as unknown as IStorageProvider,
    );
    await expect(service.gcStalePending(24, 100)).resolves.toEqual({ deleted: 0, failed: 1 });
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
