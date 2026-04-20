import { Injectable, NotFoundException } from '@nestjs/common';
import { PUBLIC_USER_DATA_SELECT } from '@org/common';
import type { CreateUserEventInput, User, UserPublic } from '@org/common';

import { UpdateUserDto } from '../../dto/update-user.dto';
import type { IUserRepository } from '../../interfaces/user.interface';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserPrismaRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async upsert(data: CreateUserEventInput): Promise<UserPublic> {
    try {
      return await this.prisma.user.upsert({
        where: { id: data.id },
        create: data,
        update: {},
        select: PUBLIC_USER_DATA_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // email taken by a stale record with a different id — realign it to the new credentials id
        return this.prisma.user.update({
          where: { email: data.email },
          data: { id: data.id },
          select: PUBLIC_USER_DATA_SELECT,
        });
      }
      throw error;
    }
  }

  async findManyByIds(ids: string[]): Promise<UserPublic[]> {
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: PUBLIC_USER_DATA_SELECT,
    });
  }

  async getAllPublic(): Promise<UserPublic[]> {
    return this.prisma.user.findMany({ select: PUBLIC_USER_DATA_SELECT });
  }

  async update(id: string, data: UpdateUserDto): Promise<UserPublic> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: PUBLIC_USER_DATA_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }
}
