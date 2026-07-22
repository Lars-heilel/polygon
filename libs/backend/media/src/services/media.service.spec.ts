import type { IStorageProvider } from '@org/core';
import type { File } from '@org/common';

jest.mock('@org/core', () => ({
  MEDIA_PRISMA_REPOSITORY_TOKEN: Symbol('MEDIA_PRISMA_REPOSITORY_TOKEN'),
  STORAGE_PROVIDER_TOKEN: Symbol('STORAGE_PROVIDER_TOKEN'),
}));

import type { IMediaRepository } from '../interfaces/media.interface';
import { MediaService } from './media.service';

type MediaReferenceOwnerType = 'MESSAGE_ATTACHMENT';

interface MediaReferenceResponse {
  id: string;
  fileId: string;
  ownerType: MediaReferenceOwnerType;
  ownerId: string;
  createdAt: Date;
}

interface CreateMediaReferenceInput {
  fileId: string;
  ownerType: MediaReferenceOwnerType;
  ownerId: string;
}

interface DeleteMediaReferenceInput {
  ownerType: MediaReferenceOwnerType;
  ownerId: string;
}

type MediaRepositoryWithReferences = IMediaRepository & {
  createReference: jest.Mock<Promise<MediaReferenceResponse>, [CreateMediaReferenceInput]>;
  deleteReference: jest.Mock<Promise<MediaReferenceResponse | null>, [DeleteMediaReferenceInput]>;
  countReferences: jest.Mock<Promise<number>, [string]>;
};

type MediaServiceWithReferences = MediaService & {
  createReference(input: CreateMediaReferenceInput): Promise<MediaReferenceResponse>;
  deleteReference(input: DeleteMediaReferenceInput): Promise<{ deleted: boolean; remainingCount: number }>;
  delete(id: string): Promise<{ success: boolean; reason?: 'REFERENCED' }>;
};

const file: File = {
  id: '11111111-1111-4111-8111-111111111111',
  bucket: 'media-secret-bucket',
  key: 'voice/secret-key.ogg',
  originalName: 'secret-voice.ogg',
  mimeType: 'audio/ogg',
  size: 33000,
  url: null,
  uploaderId: '22222222-2222-4222-8222-222222222222',
  status: 'READY',
  chatId: '33333333-3333-4333-8333-333333333333',
  category: 'VOICE',
  createdAt: new Date('2026-07-22T00:00:00.000Z'),
  updatedAt: new Date('2026-07-22T00:00:00.000Z'),
};

function repoMock(): jest.Mocked<MediaRepositoryWithReferences> {
  return {
    findById: jest.fn(),
    findByUploaderId: jest.fn(),
    findByChatId: jest.fn(),
    countByChatId: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
    createReference: jest.fn(),
    deleteReference: jest.fn(),
    countReferences: jest.fn(),
  };
}

function storageMock(): jest.Mocked<IStorageProvider> {
  return {
    upload: jest.fn(),
    delete: jest.fn(),
    getPresignedUrl: jest.fn(),
    getPresignedPutUrl: jest.fn(),
    getFileStream: jest.fn(),
    ensureBucket: jest.fn(),
    getAvatarsBucket: jest.fn(),
    getChatBucketName: jest.fn(),
    getPublicUrl: jest.fn(),
    putObject: jest.fn(),
    setBucketPublic: jest.fn(),
  };
}

describe('MediaService', () => {
  it('creates a media reference and logs a redacted lifecycle', async () => {
    const repo = repoMock();
    const storage = storageMock();
    const reference: MediaReferenceResponse = {
      id: 'reference-secret-id',
      fileId: file.id,
      ownerType: 'MESSAGE_ATTACHMENT',
      ownerId: 'attachment-secret-id',
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
    };
    const input: CreateMediaReferenceInput = {
      fileId: file.id,
      ownerType: 'MESSAGE_ATTACHMENT',
      ownerId: 'attachment-secret-id',
    };
    repo.createReference.mockResolvedValue(reference);
    const service = new MediaService(repo, storage) as MediaServiceWithReferences;
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.createReference(input)).resolves.toEqual(reference);

    expect(repo.createReference).toHaveBeenCalledWith(input);
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'media_reference_create_requested',
      hasFileId: true,
      ownerType: 'MESSAGE_ATTACHMENT',
    }));
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'media_reference_create_started',
      hasFileId: true,
      ownerType: 'MESSAGE_ATTACHMENT',
    }));
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'media_reference_created',
      hasFileId: true,
      ownerType: 'MESSAGE_ATTACHMENT',
    }));

    const diagnosticPayload = JSON.stringify([logger.debug.mock.calls, logger.error.mock.calls, logger.log.mock.calls, logger.warn.mock.calls]);
    expect(diagnosticPayload).not.toContain(file.id);
    expect(diagnosticPayload).not.toContain(file.bucket);
    expect(diagnosticPayload).not.toContain(file.key);
    expect(diagnosticPayload).not.toContain(file.originalName);
    expect(diagnosticPayload).not.toContain(input.ownerId);
  });

  it('logs a redacted reference creation failure', async () => {
    const repo = repoMock();
    const storage = storageMock();
    repo.createReference.mockRejectedValue(new Error('storage-secret-key failure'));
    const service = new MediaService(repo, storage) as MediaServiceWithReferences;
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.createReference({
      fileId: file.id,
      ownerType: 'MESSAGE_ATTACHMENT',
      ownerId: 'attachment-secret-id',
    })).rejects.toThrow('storage-secret-key failure');

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'media_reference_create_failed',
      hasFileId: true,
      ownerType: 'MESSAGE_ATTACHMENT',
    }));
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('storage-secret-key');
  });

  it('deletes a media reference and returns the remaining reference count', async () => {
    const repo = repoMock();
    const storage = storageMock();
    repo.deleteReference.mockResolvedValue({
      id: 'reference-secret-id',
      fileId: file.id,
      ownerType: 'MESSAGE_ATTACHMENT',
      ownerId: 'attachment-secret-id',
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
    });
    repo.countReferences.mockResolvedValue(1);
    const service = new MediaService(repo, storage) as MediaServiceWithReferences;
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.deleteReference({ ownerType: 'MESSAGE_ATTACHMENT', ownerId: 'attachment-secret-id' }))
      .resolves.toEqual({ deleted: true, remainingCount: 1 });

    expect(repo.countReferences).toHaveBeenCalledWith(file.id);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'media_reference_deleted',
      hasFileId: true,
      ownerType: 'MESSAGE_ATTACHMENT',
      remainingCount: 1,
    }));
  });

  it('does not delete the physical object while media references remain', async () => {
    const repo = repoMock();
    const storage = storageMock();
    repo.findById.mockResolvedValue(file);
    repo.countReferences.mockResolvedValue(1);
    const service = new MediaService(repo, storage) as MediaServiceWithReferences;
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.delete(file.id)).resolves.toEqual({ success: false, reason: 'REFERENCED' });

    expect(storage.delete).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'media_reference_delete_skipped',
      hasFileId: true,
      referenceCount: 1,
    }));
  });

  it('deletes the physical object when no media references remain', async () => {
    const repo = repoMock();
    const storage = storageMock();
    repo.findById.mockResolvedValue(file);
    repo.countReferences.mockResolvedValue(0);
    const service = new MediaService(repo, storage) as MediaServiceWithReferences;
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    await expect(service.delete(file.id)).resolves.toEqual({ success: true });

    expect(storage.delete).toHaveBeenCalledWith(file.bucket, file.key);
    expect(repo.delete).toHaveBeenCalledWith(file.id);
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'media_file_gc_deleted',
      hasFileId: true,
    }));

    const diagnosticPayload = JSON.stringify([logger.debug.mock.calls, logger.error.mock.calls, logger.log.mock.calls, logger.warn.mock.calls]);
    expect(diagnosticPayload).not.toContain(file.id);
    expect(diagnosticPayload).not.toContain(file.bucket);
    expect(diagnosticPayload).not.toContain(file.key);
    expect(diagnosticPayload).not.toContain(file.originalName);
  });
});
