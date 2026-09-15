import { Injectable } from '@nestjs/common';
import type { SenderKeyDistribution } from '@org/common';
import { handlePrismaError } from '@org/core';

import type { ISenderKeyRepository, SenderKeyShareRecord } from '../../interfaces/chat.interface';
import { PrismaService } from '../prisma/prisma.service';

type SenderKeyShareRow = {
  chatId: string;
  chainKeyId: string;
  senderDeviceId: string;
  recipientDeviceId: string;
  wrappedChainKey: string;
  revoked: boolean;
};

const toRecord = (row: SenderKeyShareRow): SenderKeyShareRecord => ({
  chatId: row.chatId,
  chainKeyId: row.chainKeyId,
  senderDeviceId: row.senderDeviceId,
  recipientDeviceId: row.recipientDeviceId,
  wrappedChainKey: row.wrappedChainKey,
  revoked: row.revoked,
});

/**
 * Prisma-backed sender-key share registry (chat-service database only).
 * Re-distributing an existing triple refreshes the wrapped key and clears
 * revocation; rotation revokes rows for removed devices only.
 */
@Injectable()
export class SenderKeyPrismaRepository implements ISenderKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertShare(input: SenderKeyDistribution): Promise<SenderKeyShareRecord> {
    try {
      const row = await this.prisma.senderKeyShare.upsert({
        where: {
          chatId_chainKeyId_recipientDeviceId: {
            chatId: input.chatId,
            chainKeyId: input.chainKeyId,
            recipientDeviceId: input.recipientDeviceId,
          },
        },
        create: { ...input, revoked: false },
        update: {
          senderDeviceId: input.senderDeviceId,
          wrappedChainKey: input.wrappedChainKey,
          revoked: false,
        },
      });
      return toRecord(row);
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findShare(
    chatId: string,
    chainKeyId: string,
    recipientDeviceId: string,
  ): Promise<SenderKeyShareRecord | null> {
    try {
      const row = await this.prisma.senderKeyShare.findUnique({
        where: { chatId_chainKeyId_recipientDeviceId: { chatId, chainKeyId, recipientDeviceId } },
      });
      if (!row || row.revoked) return null;
      return toRecord(row);
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findLatestChainId(chatId: string, senderDeviceId: string): Promise<string | null> {
    try {
      const row = await this.prisma.senderKeyShare.findFirst({
        where: { chatId, senderDeviceId, revoked: false },
        orderBy: { createdAt: 'desc' },
        select: { chainKeyId: true },
      });
      return row?.chainKeyId ?? null;
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async revokeShares(chatId: string, recipientDeviceIds: string[]): Promise<void> {
    if (recipientDeviceIds.length === 0) return;
    try {
      await this.prisma.senderKeyShare.updateMany({
        where: { chatId, recipientDeviceId: { in: recipientDeviceIds } },
        data: { revoked: true },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
