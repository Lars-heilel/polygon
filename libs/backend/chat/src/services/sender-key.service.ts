import { Injectable, Logger } from '@nestjs/common';
import type { SenderKeyDistribution } from '@org/common';
import { senderKeyDistributionSchema } from '@org/common';
import { randomUUID } from 'node:crypto';

import type { ISenderKeyService, SenderKeyShareRecord } from '../interfaces/chat.interface';

const shareKey = (chatId: string, chainKeyId: string, recipientDeviceId: string): string =>
  `${chatId}|${chainKeyId}|${recipientDeviceId}`;

/**
 * Server-side registry for group sender-key distribution shares.
 *
 * The service stores only opaque wrapped chain keys (ciphertext produced by
 * the sender with 1:1 sessions) — it never sees plaintext or raw chain keys.
 * Shares are process-local; the `SenderKeyShare` Prisma model reserves the
 * durable layout for a follow-up without changing this interface.
 */
@Injectable()
export class SenderKeyService implements ISenderKeyService {
  private readonly logger = new Logger(SenderKeyService.name);
  private readonly shares = new Map<string, SenderKeyShareRecord>();

  async distributeShare(input: SenderKeyDistribution): Promise<SenderKeyDistribution> {
    this.logger.log({
      eventType: 'senderkey_distribute_requested',
      hasChatId: !!input.chatId,
      hasChainKeyId: !!input.chainKeyId,
      hasSenderDeviceId: !!input.senderDeviceId,
      hasRecipientDeviceId: !!input.recipientDeviceId,
      hasWrappedChainKey: !!input.wrappedChainKey,
    });
    const parsed = senderKeyDistributionSchema.parse(input);
    const record: SenderKeyShareRecord = { ...parsed, revoked: false };
    this.shares.set(shareKey(parsed.chatId, parsed.chainKeyId, parsed.recipientDeviceId), record);
    this.logger.log({
      eventType: 'senderkey_distribute_done',
      hasChatId: !!parsed.chatId,
      hasChainKeyId: !!parsed.chainKeyId,
      hasRecipientDeviceId: !!parsed.recipientDeviceId,
    });
    const { revoked: _revoked, ...share } = record;
    return share;
  }

  async distributeShares(inputs: SenderKeyDistribution[]): Promise<SenderKeyDistribution[]> {
    const stored: SenderKeyDistribution[] = [];
    for (const input of inputs) {
      stored.push(await this.distributeShare(input));
    }
    return stored;
  }

  async getShare(
    chatId: string,
    recipientDeviceId: string,
    chainKeyId?: string,
  ): Promise<SenderKeyShareRecord | null> {
    for (const share of this.shares.values()) {
      if (share.chatId !== chatId || share.recipientDeviceId !== recipientDeviceId) continue;
      if (share.revoked) continue;
      if (chainKeyId && share.chainKeyId !== chainKeyId) continue;
      return share;
    }
    return null;
  }

  async rotateChain(
    chatId: string,
    removedDeviceIds: string[] = [],
  ): Promise<{ chainKeyId: string }> {
    this.logger.log({
      eventType: 'senderkey_rotate_requested',
      hasChatId: !!chatId,
      removedDeviceCount: removedDeviceIds.length,
    });
    const removed = new Set(removedDeviceIds);
    // Revoke old shares for removed devices only — remaining members keep
    // reading history with their existing shares.
    for (const share of this.shares.values()) {
      if (share.chatId === chatId && removed.has(share.recipientDeviceId)) {
        share.revoked = true;
      }
    }
    const chainKeyId = randomUUID();
    this.logger.log({
      eventType: 'senderkey_rotate_done',
      hasChatId: !!chatId,
      hasChainKeyId: !!chainKeyId,
      removedDeviceCount: removedDeviceIds.length,
    });
    return { chainKeyId };
  }

  async revokeShares(chatId: string, recipientDeviceId: string): Promise<void> {
    this.logger.log({
      eventType: 'senderkey_revoke_requested',
      hasChatId: !!chatId,
      hasRecipientDeviceId: !!recipientDeviceId,
    });
    for (const share of this.shares.values()) {
      if (share.chatId === chatId && share.recipientDeviceId === recipientDeviceId) {
        share.revoked = true;
      }
    }
    this.logger.log({
      eventType: 'senderkey_revoke_done',
      hasChatId: !!chatId,
      hasRecipientDeviceId: !!recipientDeviceId,
    });
  }
}
