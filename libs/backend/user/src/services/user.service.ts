import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CreateUserEventInput, User, UserPublic } from '@org/common';
import { REDIS_CLIENT, USER_PRISMA_REPOSITORY_TOKEN } from '@org/core';
import type Redis from 'ioredis';

import { UpdateUserDto } from '../dto/update-user.dto';
import type { IUserRepository, IUserService } from '../interfaces/user.interface';

const PROFILE_CACHE_TTL_SECONDS = 60;
const profileCacheKey = (id: string): string => `user:profile:${id}`;

@Injectable()
export class UserService implements IUserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(USER_PRISMA_REPOSITORY_TOKEN) private readonly repo: IUserRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async createFromEvent(data: CreateUserEventInput): Promise<UserPublic> {
    this.logger.debug({ eventType: 'user_create_request' });
    const created = await this.repo.upsert(data);
    await this.invalidateProfile(data.id);
    this.logger.debug({ eventType: 'user_create_done' });
    return created;
  }

  async getById(id: string): Promise<User> {
    try {
      const cached = await this.redis.get(profileCacheKey(id));
      if (cached) return JSON.parse(cached) as User;
    } catch {
      // silent fallback to repo
    }
    const user = await this.repo.findById(id);
    if (!user) {
      this.logger.debug({ eventType: 'user_get_not_found' });
      throw new NotFoundException('User not found');
    }
    try {
      await this.redis.set(
        profileCacheKey(id),
        JSON.stringify(user),
        'EX',
        PROFILE_CACHE_TTL_SECONDS,
      );
    } catch {
      // silent
    }
    return user;
  }

  async getManyByIds(ids: string[]): Promise<UserPublic[]> {
    return this.repo.findManyByIds(ids);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserPublic> {
    const updatedUser = await this.repo.update(id, dto);
    await this.invalidateProfile(id);
    this.logger.debug({ eventType: 'user_update_done' });
    return updatedUser;
  }

  async getAllPublic(): Promise<UserPublic[]> {
    return this.repo.getAllPublic();
  }

  private async invalidateProfile(id: string): Promise<void> {
    try {
      await this.redis.del(profileCacheKey(id));
    } catch {
      // silent
    }
  }
}
