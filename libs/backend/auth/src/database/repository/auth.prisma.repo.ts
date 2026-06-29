import { Injectable } from '@nestjs/common';
import type { CreateCredentialsInput, Credentials } from '@org/common';
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

  async saveSession(data: {
    id: string;
    tokenHash: string;
    credentialsId: string;
    expiresAt: Date;
    ip?: string;
    country?: string;
    os?: string;
    browser?: string;
    device?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.prisma.session.create({ data });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findSessionByTokenHash(tokenHash: string): Promise<any | null> {
    return this.prisma.session.findUnique({ where: { tokenHash } });
  }

  async revokeSession(tokenHash: string): Promise<void> {
    try {
      await this.prisma.session.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async revokeAllSessions(credentialsId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { credentialsId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async findActiveSessions(credentialsId: string): Promise<any[]> {
    return this.prisma.session.findMany({
      where: { credentialsId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSessionById(sessionId: string): Promise<any | null> {
    return this.prisma.session.findUnique({ where: { id: sessionId } });
  }

  async updateSessionLastActive(sessionId: string): Promise<void> {
    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { lastActiveAt: new Date() },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async updateSessionTokenHash(sessionId: string, newTokenHash: string): Promise<void> {
    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { tokenHash: newTokenHash },
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
