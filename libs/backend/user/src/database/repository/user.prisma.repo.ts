import { Injectable } from '@nestjs/common';
import { USER_SELECT_FIELDS, USER_PUBLIC_SELECT_FIELDS } from '@org/common';
import type {
  User,
  UserPublic,
  UpdateUserInput,
  CreateUserEventInput,
} from '@org/common';
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

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: USER_SELECT_FIELDS,
    });
  }

  async findPublicById(id: string): Promise<UserPublic | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT_FIELDS,
    });
  }

  async searchByName(query: string): Promise<UserPublic[]> {
    return this.prisma.user.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      select: USER_PUBLIC_SELECT_FIELDS,
    });
  }

  async upsert(data: CreateUserEventInput): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: data.id },
      create: data,
      update: {},
    });
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT_FIELDS,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async exists(id: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    return user !== null;
  }
}
