import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { SenderKeyDistribution } from '@org/common';
import { senderKeyDistributionSchema } from '@org/common';
import { SENDER_KEY_REPOSITORY_TOKEN } from '@org/core';
import { randomUUID } from 'node:crypto';

import { InMemorySenderKeyRepository } from '../database/repository/sender-key.memory.repo';
import type {
  ISenderKeyRepository,
  ISenderKeyService,
  SenderKeyShareRecord,
} from '../interfaces/chat.interface';

/**
 * Server-side registry for group sender-key distribution shares.
 *
 * The service stores only opaque wrapped chain keys (ciphertext produced by
 * the sender with 1:1 sessions) — it never sees plaintext or raw chain keys.
 * Shares persist via the injected repository (Prisma `SenderKeyShare` in
 * production, process-local memory in unit tests).
 */
@Injectable()
export class SenderKeyService implements ISenderKeyService {
  private readonly logger = new Logger(SenderKeyService.name);
  private readonly repo: ISenderKeyRepository;

  constructor(
    @Optional()
    @Inject(SENDER_KEY_REPOSITORY_TOKEN)
    repo?: ISenderKeyRepository,
  ) {
    this.repo = repo ?? new InMemorySenderKeyRepository();
  }

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
    const { revoked: _revoked, ...share } = await this.repo.upsertShare(parsed);
    this.logger.log({
      eventType: 'senderkey_distribute_done',
      hasChatId: !!parsed.chatId,
      hasChainKeyId: !!parsed.chainKeyId,
      hasRecipientDeviceId: !!parsed.recipientDeviceId,
    });
    return share;
  }

  async distributeShares(inputs: SenderKeyDistribution[]): Promise<SenderKeyDistribution[]> {
    if (inputs.length === 0) {
      this.logger.log({ eventType: 'senderkey_distribute_done', emptyBatch: true });
      return [];
    }
    const stored: SenderKeyDistribution[] = [];
    for (const input of inputs) {
      stored.push(await this.distributeShare(input));
    }
    return stored;
  }

  async getShare(
    chatId: string,
    chainKeyId: string,
    recipientDeviceId: string,
  ): Promise<SenderKeyShareRecord | null> {
    return this.repo.findShare(chatId, chainKeyId, recipientDeviceId);
  }

  async getLatestChainId(chatId: string, senderDeviceId: string): Promise<string | null> {
    return this.repo.findLatestChainId(chatId, senderDeviceId);
  }

  /**
   * Mint a fresh chain id and revoke old shares for removed devices only.
   * Remaining members keep their existing shares, so old history stays
   * readable to them. An empty `removedDeviceIds` list is valid proactive
   * rotation (e.g. scheduled re-key): no shares are revoked, only the new
   * chain id is minted for redistribution.
   */
  async rotateChain(
    chatId: string,
    removedDeviceIds: string[] = [],
  ): Promise<{ chainKeyId: string }> {
    this.logger.log({
      eventType: 'senderkey_rotate_requested',
      hasChatId: !!chatId,
      removedDeviceCount: removedDeviceIds.length,
    });
    // Revoke old shares for removed devices only — remaining members keep
    // reading history with their existing shares.
    await this.repo.revokeShares(chatId, removedDeviceIds);
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
    await this.repo.revokeShares(chatId, [recipientDeviceId]);
    this.logger.log({
      eventType: 'senderkey_revoke_done',
      hasChatId: !!chatId,
      hasRecipientDeviceId: !!recipientDeviceId,
    });
  }
}
