import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CreateUserEventInput, User, UserPublic } from '@org/common';
import { USER_PRISMA_REPOSITORY_TOKEN } from '@org/core';

import { UpdateUserDto } from '../dto/update-user.dto';
import type { IUserRepository, IUserService } from '../interfaces/user.interface';

@Injectable()
export class UserService implements IUserService {
  private readonly logger = new Logger(UserService.name);

  constructor(@Inject(USER_PRISMA_REPOSITORY_TOKEN) private readonly repo: IUserRepository) {}

  async createFromEvent(data: CreateUserEventInput): Promise<UserPublic> {
    this.logger.debug(`Create new account for user:${data.email}`);
    return await this.repo.upsert(data);
  }

  async getById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) {
      this.logger.debug(`user:${id} not found`);
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserPublic> {
    const updatedUser = await this.repo.update(id, dto);
    this.logger.debug(`User ${id} updated`);
    return updatedUser;
  }

  async getAllPublic(): Promise<UserPublic[]> {
    return this.repo.getAllPublic();
  }
}
