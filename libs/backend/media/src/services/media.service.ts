import { Inject, Injectable } from '@nestjs/common';

import { MEDIA_PRISMA_REPOSITORY_TOKEN, STORAGE_PROVIDER_TOKEN } from '@org/core';
import type { IStorageProvider } from '@org/core';
import type { IMediaRepository, IMediaService } from '../interfaces/media.interface';

@Injectable()
export class MediaService implements IMediaService {
  constructor(
    @Inject(MEDIA_PRISMA_REPOSITORY_TOKEN) private readonly repo: IMediaRepository,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storage: IStorageProvider,
  ) {
    void this.repo;
    void this.storage;
  }
}
