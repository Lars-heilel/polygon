import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateUserEventInput, UpdateUserInput, User, UserPublic } from '@org/common';
import { USER_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import type { IUserRepository, IUserService } from '../interfaces/user.interface';

@Injectable()
export class UserService implements IUserService {
  constructor(@Inject(USER_PRISMA_REPOSITORY_TOKEN) private readonly repo: IUserRepository) {}

  async createFromEvent(data: CreateUserEventInput): Promise<void> {
    await this.repo.upsert(data);
  }

  async getById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPublicById(id: string): Promise<UserPublic> {
    const user = await this.repo.findPublicById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserInput): Promise<User> {
    const exists = await this.repo.exists(id);
    if (!exists) throw new NotFoundException('User not found');
    return this.repo.update(id, dto);
  }
}
