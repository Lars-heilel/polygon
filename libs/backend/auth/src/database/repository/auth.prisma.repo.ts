import { Injectable } from '@nestjs/common';
import type { CreateCredentialsInput, Credentials, RefreshToken } from '@org/common';
import { handlePrismaError } from '@org/core';

import type { IAuthRepository } from '../../interfaces/auth.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthPrismaRepository implements IAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<Credentials | null> {
    return this.prisma.credentials.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<Credentials | null> {
    return this.prisma.credentials.findUnique({
      where: { id },
    });
  }

  async createCredentials(data: CreateCredentialsInput): Promise<Credentials> {
    try {
      return await this.prisma.credentials.create({
        data,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    try {
      await this.prisma.credentials.update({
        where: { id },
        data: { passwordHash },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
  //! пустой объект кредов
  async findOAuthAccount(
    provider: string,
    providerId: string,
  ): Promise<{ credentials: Credentials } | null> {
    return this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
      select: { credentials: {} },
    });
  }

  async createOAuthAccount(data: {
    provider: string;
    providerId: string;
    credentialsId: string;
  }): Promise<void> {
    try {
      await this.prisma.oAuthAccount.create({ data });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async saveRefreshToken(data: {
    tokenHash: string;
    credentialsId: string;
    expiresAt: Date;
  }): Promise<void> {
    try {
      await this.prisma.refreshToken.create({ data });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    try {
      await this.prisma.refreshToken.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async verifyCredentials(id: string): Promise<void> {
    try {
      await this.prisma.credentials.update({
        where: { id },
        data: { isVerified: true },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async revokeAllRefreshTokens(credentialsId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { credentialsId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteUnverifiedOlderThan(before: Date): Promise<number> {
    const result = await this.prisma.credentials.deleteMany({
      where: {
        isVerified: false,
        passwordHash: { not: null },
        createdAt: { lt: before },
      },
    });
    return result.count;
  }
}
