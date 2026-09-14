import { Injectable } from '@nestjs/common';
import type { DeviceRecord, RegisterDeviceInput } from '@org/common';
import { handlePrismaError } from '@org/core';

import type { IE2eeKeyRepository, SignedPrekeyPair } from '../../interfaces/chat.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Prisma-backed E2EE key registry (chat-service database only).
 * Devices and one-time prekeys persist in Postgres; the signed prekey is
 * process-local until a dedicated model lands (see Task 1 report).
 */
@Injectable()
export class E2eeKeyPrismaRepository implements IE2eeKeyRepository {
  private readonly signedPrekeys = new Map<string, SignedPrekeyPair>();

  constructor(private readonly prisma: PrismaService) {}

  async upsertDevice(input: RegisterDeviceInput): Promise<DeviceRecord> {
    try {
      const row = await this.prisma.device.upsert({
        where: { deviceId: input.deviceId },
        create: {
          deviceId: input.deviceId,
          userId: input.userId,
          identityKey: input.identityKey,
          registrationId: input.registrationId,
        },
        update: {
          userId: input.userId,
          identityKey: input.identityKey,
          registrationId: input.registrationId,
          lastSeenAt: new Date(),
        },
      });
      return {
        userId: row.userId,
        deviceId: row.deviceId,
        identityKey: row.identityKey,
        registrationId: row.registrationId,
      };
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findDevice(deviceId: string): Promise<DeviceRecord | null> {
    try {
      const row = await this.prisma.device.findUnique({ where: { deviceId } });
      if (!row) return null;
      return {
        userId: row.userId,
        deviceId: row.deviceId,
        identityKey: row.identityKey,
        registrationId: row.registrationId,
      };
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async deleteDevice(deviceId: string): Promise<void> {
    try {
      await this.prisma.oneTimePrekey.deleteMany({ where: { deviceId } });
      await this.prisma.device.deleteMany({ where: { deviceId } });
      this.signedPrekeys.delete(deviceId);
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async saveSignedPrekey(
    deviceId: string,
    signedPrekey: string,
    signedPrekeySignature: string,
  ): Promise<void> {
    this.signedPrekeys.set(deviceId, { signedPrekey, signedPrekeySignature });
  }

  async findSignedPrekey(deviceId: string): Promise<SignedPrekeyPair | null> {
    return this.signedPrekeys.get(deviceId) ?? null;
  }

  async addOneTimePrekeys(deviceId: string, prekeys: string[]): Promise<void> {
    if (prekeys.length === 0) return;
    try {
      await this.prisma.oneTimePrekey.createMany({
        data: prekeys.map((prekey) => ({ deviceId, prekey, consumed: false })),
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async consumeOneTimePrekey(deviceId: string): Promise<string | null> {
    try {
      const next = await this.prisma.oneTimePrekey.findFirst({
        where: { deviceId, consumed: false },
        orderBy: { id: 'asc' },
      });
      if (!next) return null;
      await this.prisma.oneTimePrekey.update({
        where: { id: next.id },
        data: { consumed: true },
      });
      return next.prekey;
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
