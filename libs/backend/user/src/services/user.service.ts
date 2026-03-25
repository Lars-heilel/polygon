import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@org/common';
import { UserPrismaRepository } from '../database/repository/user.prisma.repo';
import type { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly repo: UserPrismaRepository) {}

  async createFromEvent(data: { id: string; email: string; name: string }): Promise<void> {
    await this.repo.create({ ...data, createdAt: new Date() });
  }

  async getById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const exists = await this.repo.exists(id);
    if (!exists) throw new NotFoundException('User not found');
    return this.repo.update(id, dto);
  }
}
