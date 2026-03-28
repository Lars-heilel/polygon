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
    passwordHash?: string;
    createdAt: Date;
  }): Promise<Credentials> {
    return this.prisma.credentials.create({ data });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.credentials.update({ where: { id }, data: { passwordHash } });
  }

  async findOAuthAccount(provider: string, providerId: string) {
    return this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
      include: { credentials: true },
    });
  }

  async createOAuthAccount(data: {
    id: string;
    provider: string;
    providerId: string;
    credentialsId: string;
  }): Promise<void> {
    await this.prisma.oAuthAccount.create({ data });
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

  async verifyCredentials(id: string): Promise<void> {
    await this.prisma.credentials.update({
      where: { id },
      data: { isVerified: true },
    });
  }

  async revokeAllRefreshTokens(credentialsId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { credentialsId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
