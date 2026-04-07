import { Injectable } from '@nestjs/common';
import { USER_PUBLIC_SELECT_FIELDS, USER_SELECT_FIELDS } from '@org/common';
import type { CreateUserEventInput, UpdateUserInput, User, UserPublic } from '@org/common';

import type { IUserRepository } from '../../interfaces/user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserPrismaRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT_FIELDS,
    });
  }

  async findPublicById(id: string): Promise<UserPublic | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT_FIELDS,
    });
  }

  async findAllPublic(): Promise<UserPublic[]> {
    return this.prisma.user.findMany({ select: USER_PUBLIC_SELECT_FIELDS });
  }

  async upsert(data: CreateUserEventInput): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: data.id },
      create: data,
      update: {},
    });
  }

  async update(id: string, data: UpdateUserInput): Promise<User | null> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: USER_SELECT_FIELDS,
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025') return null;
      throw e;
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
