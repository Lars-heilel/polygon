import type { IMediaService } from '../../interfaces/media.interface';
import { MediaController } from '../media.controller';

jest.mock('@org/core', () => ({
  MEDIA_PATTERNS: {
    INIT_UPLOAD: 'media.initUpload',
    CONFIRM_UPLOAD: 'media.confirmUpload',
    GET_BY_ID: 'media.getById',
    GET_FILE_URL: 'media.getFileUrl',
    GET_FILE_CONTENT: 'media.getFileContent',
    DELETE: 'media.delete',
    GET_HISTORY: 'media.getHistory',
    GET_ADMIN_AVATAR_HISTORY: 'media.admin.getAvatarHistory',
    GET_CHAT_HISTORY: 'media.getChatHistory',
    CREATE_FILE: 'media.createFile',
    CREATE_REFERENCE: 'media.references.create',
    DELETE_REFERENCE: 'media.references.delete',
    COUNT_REFERENCES: 'media.references.count',
    GC_STALE: 'media.gcStale',
  },
  MEDIA_SERVICE_TOKEN: Symbol('MEDIA_SERVICE'),
}));

describe('MediaController', () => {
  let mediaService: {
    initUpload: jest.Mock;
    confirmUpload: jest.Mock;
    getById: jest.Mock;
    getFileContent: jest.Mock;
    delete: jest.Mock;
    createReference: jest.Mock;
    deleteReference: jest.Mock;
    countReferences: jest.Mock;
    getHistory: jest.Mock;
    getChatHistory: jest.Mock;
    create: jest.Mock;
    gcStalePending: jest.Mock;
  };
  let controller: MediaController;

  beforeEach(() => {
    mediaService = {
      initUpload: jest.fn(),
      confirmUpload: jest.fn(),
      getById: jest.fn(),
      getFileContent: jest.fn(),
      delete: jest.fn(),
      createReference: jest.fn(),
      deleteReference: jest.fn(),
      countReferences: jest.fn(),
      getHistory: jest.fn(),
      getChatHistory: jest.fn(),
      create: jest.fn(),
      gcStalePending: jest.fn(),
    };
    controller = new MediaController(mediaService as unknown as IMediaService);
  });

  it('forwards initUpload with uploaderId split from input', async () => {
    mediaService.initUpload.mockResolvedValue({ fileId: 'file-1', presignedUrl: 'https://x' });
    await expect(
      controller.initUpload({
        originalName: 'a.jpg',
        mimeType: 'image/jpeg',
        size: 10,
        category: 'IMAGE',
        chatId: 'chat-1',
        uploaderId: 'user-1',
      }),
    ).resolves.toEqual({ fileId: 'file-1', presignedUrl: 'https://x' });
    expect(mediaService.initUpload).toHaveBeenCalledWith(
      {
        originalName: 'a.jpg',
        mimeType: 'image/jpeg',
        size: 10,
        category: 'IMAGE',
        chatId: 'chat-1',
      },
      'user-1',
    );
  });

  it('delegates confirm/get/delete/history', async () => {
    await controller.confirmUpload({ fileId: 'file-1' });
    expect(mediaService.confirmUpload).toHaveBeenCalledWith('file-1');
    await controller.getById({ id: 'file-1' });
    expect(mediaService.getById).toHaveBeenCalledWith('file-1');
    await controller.delete({ id: 'file-1' });
    expect(mediaService.delete).toHaveBeenCalledWith('file-1');
    await controller.getHistory({ uploaderId: 'user-1', category: 'IMAGE' });
    expect(mediaService.getHistory).toHaveBeenCalledWith('user-1', 'IMAGE');
    await controller.getChatHistory({ chatId: 'chat-1', uploaderId: 'user-1', take: 10 });
    expect(mediaService.getChatHistory).toHaveBeenCalledWith('chat-1', 'user-1', {
      category: undefined,
      take: 10,
      skip: undefined,
    });
  });

  it('delegates references and gcStale', async () => {
    await controller.createFile({ bucket: 'b', key: 'k' } as never);
    expect(mediaService.create).toHaveBeenCalledWith({ bucket: 'b', key: 'k' });
    await controller.createReference({ fileId: 'file-1' } as never);
    expect(mediaService.createReference).toHaveBeenCalledWith({ fileId: 'file-1' });
    await controller.deleteReference({ ownerId: 'o-1' } as never);
    expect(mediaService.deleteReference).toHaveBeenCalledWith({ ownerId: 'o-1' });
    await controller.countReferences({ fileId: 'file-1' });
    expect(mediaService.countReferences).toHaveBeenCalledWith('file-1');
    mediaService.gcStalePending.mockResolvedValue({ deleted: 3, failed: 0 });
    await expect(controller.gcStale({ olderThanHours: 24, take: 100 })).resolves.toEqual({
      deleted: 3,
      failed: 0,
    });
    expect(mediaService.gcStalePending).toHaveBeenCalledWith(24, 100);
  });
});
