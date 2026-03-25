import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Credentials | null> {
    return this.prisma.credentials.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<Credentials | null> {
    return this.prisma.credentials.findUnique({ where: { email } });
  }

  async findAll(): Promise<Credentials[]> {
    return this.prisma.credentials.findMany();
  }

  async create(data: {
    email: string;
    role?: Role;
    passwordHash: string;
    isVerified?: boolean;
    lockedAt?: Date | null;
    lockedUntil?: Date | null;
  }): Promise<Credentials> {
    return this.prisma.credentials.create({ data });
  }

  async update(id: string, data: {
    email?: string;
    role?: Role;
    passwordHash?: string;
    isVerified?: boolean;
    lockedAt?: Date | null;
    lockedUntil?: Date | null;
  }): Promise<Credentials> {
    return this.prisma.credentials.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Credentials> {
    return this.prisma.credentials.delete({ where: { id } });
  }

  async exists(id: string): Promise<boolean> {
    const credentials = await this.prisma.credentials.findUnique({ where: { id }, select: { id: true } });
    return credentials !== null;
  }

  async findByRole(role: Role): Promise<Credentials[]> {
    return this.prisma.credentials.findMany({ where: { role } });
  }

  async setVerified(id: string, verified: boolean): Promise<Credentials> {
    return this.prisma.credentials.update({
      where: { id },
      data: { isVerified: verified },
    });
  }

  async lock(id: string, lockedUntil: Date | null): Promise<Credentials> {
    return this.prisma.credentials.update({
      where: { id },
      data: {
        lockedAt: new Date(),
        lockedUntil,
      },
    });
  }

  async unlock(id: string): Promise<Credentials> {
    return this.prisma.credentials.update({
      where: { id },
      data: {
        lockedAt: null,
        lockedUntil: null,
      },
    });
  }
}
