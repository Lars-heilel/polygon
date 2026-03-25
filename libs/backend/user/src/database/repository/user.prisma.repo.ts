import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@org/common';

@Injectable()
export class UserPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByName(name: string): Promise<User[]> {
    return this.prisma.user.findMany({ where: { name } });
  }

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async create(data: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(
    id: string,
    data: {
      displayName?: string | null;
      avatarUrl?: string | null;
      bio?: string | null;
    }
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }

  async exists(id: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    return user !== null;
  }
}
