import { Injectable } from '@nestjs/common';
import type { DeviceRecord, RegisterDeviceInput } from '@org/common';
import { handlePrismaError } from '@org/core';

import type { IE2eeKeyRepository, SignedPrekeyPair } from '../../interfaces/chat.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Prisma-backed E2EE key registry (chat-service database only).
 * Devices, signed prekeys, and one-time prekeys persist in Postgres.
 */
@Injectable()
export class E2eeKeyPrismaRepository implements IE2eeKeyRepository {
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

  async findDevicesByUserIds(userIds: string[]): Promise<DeviceRecord[]> {
    if (userIds.length === 0) return [];
    try {
      const rows = await this.prisma.device.findMany({
        where: { userId: { in: userIds } },
      });
      return rows.map((row) => ({
        userId: row.userId,
        deviceId: row.deviceId,
        identityKey: row.identityKey,
        registrationId: row.registrationId,
      }));
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async deleteDevice(deviceId: string): Promise<void> {
    try {
      await this.prisma.oneTimePrekey.deleteMany({ where: { deviceId } });
      await this.prisma.signedPrekey.deleteMany({ where: { deviceId } });
      await this.prisma.device.deleteMany({ where: { deviceId } });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async saveSignedPrekey(
    deviceId: string,
    signedPrekey: string,
    signedPrekeySignature: string,
  ): Promise<void> {
    try {
      await this.prisma.signedPrekey.upsert({
        where: { deviceId },
        create: { deviceId, signedPrekey, signedPrekeySignature },
        update: { signedPrekey, signedPrekeySignature },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findSignedPrekey(deviceId: string): Promise<SignedPrekeyPair | null> {
    try {
      const row = await this.prisma.signedPrekey.findUnique({ where: { deviceId } });
      if (!row) return null;
      return {
        signedPrekey: row.signedPrekey,
        signedPrekeySignature: row.signedPrekeySignature,
      };
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async addOneTimePrekeys(deviceId: string, prekeys: string[]): Promise<void> {
    // Replace semantics: a publish supersedes every previous generation.
    // Stale rows would otherwise be dealt to senders while the matching
    // private halves are long gone from the device (permanent
    // E2EE_DECRYPT_FAILED with no recovery path).
    if (prekeys.length === 0) return;
    try {
      await this.prisma.oneTimePrekey.deleteMany({ where: { deviceId } });
      await this.prisma.oneTimePrekey.createMany({
        data: prekeys.map((prekey) => ({ deviceId, prekey, consumed: false })),
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async consumeOneTimePrekey(deviceId: string): Promise<string | null> {
    try {
      for (;;) {
        const next = await this.prisma.oneTimePrekey.findFirst({
          where: { deviceId, consumed: false },
          orderBy: { id: 'asc' },
        });
        if (!next) return null;
        // Atomic claim: only one concurrent initiation can flip
        // consumed false→true. count === 0 means we lost the race, so
        // retry with the next key (each retry implies another initiation
        // made progress, so the loop is bounded).
        const claimed = await this.prisma.oneTimePrekey.updateMany({
          where: { id: next.id, consumed: false },
          data: { consumed: true },
        });
        if (claimed.count > 0) return next.prekey;
      }
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
