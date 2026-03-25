import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Credentials, RefreshToken } from '@org/common';

@Injectable()
export class AuthPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<Credentials | null> {
    return this.prisma.credentials.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<Credentials | null> {
    return this.prisma.credentials.findUnique({ where: { id } });
  }

  async createCredentials(data: {
    id: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
  }): Promise<Credentials> {
    return this.prisma.credentials.create({ data });
  }

  async saveRefreshToken(data: {
    tokenHash: string;
    credentialsId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({ data });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllRefreshTokens(credentialsId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { credentialsId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
