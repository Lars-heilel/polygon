import { Injectable } from '@nestjs/common';
import type { SenderKeyDistribution } from '@org/common';

import type { ISenderKeyRepository, SenderKeyShareRecord } from '../../interfaces/chat.interface';

const shareKey = (chatId: string, chainKeyId: string, recipientDeviceId: string): string =>
  `${chatId}|${chainKeyId}|${recipientDeviceId}`;

/**
 * Process-local sender-key share registry. Used in unit tests (no live DB)
 * and as the fallback when no Prisma-backed repository is injected.
 */
@Injectable()
export class InMemorySenderKeyRepository implements ISenderKeyRepository {
  private readonly shares = new Map<string, SenderKeyShareRecord & { seq: number }>();
  private seq = 0;

  async upsertShare(input: SenderKeyDistribution): Promise<SenderKeyShareRecord> {
    const key = shareKey(input.chatId, input.chainKeyId, input.recipientDeviceId);
    const existing = this.shares.get(key);
    const record = { ...input, revoked: false, seq: existing?.seq ?? (this.seq += 1) };
    this.shares.set(key, record);
    const { seq: _seq, ...share } = record;
    return share;
  }

  async findShare(
    chatId: string,
    chainKeyId: string,
    recipientDeviceId: string,
  ): Promise<SenderKeyShareRecord | null> {
    const record = this.shares.get(shareKey(chatId, chainKeyId, recipientDeviceId));
    if (!record || record.revoked) return null;
    const { seq: _seq, ...share } = record;
    return share;
  }

  async findLatestChainId(chatId: string, senderDeviceId: string): Promise<string | null> {
    let latest: { chainKeyId: string; seq: number } | null = null;
    for (const record of this.shares.values()) {
      if (record.chatId !== chatId || record.senderDeviceId !== senderDeviceId) continue;
      if (record.revoked) continue;
      if (!latest || record.seq > latest.seq) {
        latest = { chainKeyId: record.chainKeyId, seq: record.seq };
      }
    }
    return latest?.chainKeyId ?? null;
  }

  async revokeShares(chatId: string, recipientDeviceIds: string[]): Promise<void> {
    if (recipientDeviceIds.length === 0) return;
    const removed = new Set(recipientDeviceIds);
    for (const record of this.shares.values()) {
      if (record.chatId === chatId && removed.has(record.recipientDeviceId)) {
        record.revoked = true;
      }
    }
  }
}
