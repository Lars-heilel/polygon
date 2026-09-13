import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@org/core';
import * as webpush from 'web-push';

import type { IPushSubscriptionRepository, PushPayload, PushSubscriptionData } from '../interfaces/notification.interface';
import { PUSH_SUBSCRIPTION_REPOSITORY_TOKEN } from '../tokens/push.tokens';

export interface PushResult {
  success: boolean;
  endpoint: string;
  error?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY_TOKEN)
    private readonly repo: IPushSubscriptionRepository,
    private readonly config: ConfigService<Env>,
  ) {
    const publicKey = this.config.getOrThrow('VAPID_PUBLIC_KEY', { infer: true });
    const privateKey = this.config.getOrThrow('VAPID_PRIVATE_KEY', { infer: true });
    const subject = this.config.getOrThrow('VAPID_SUBJECT', { infer: true });

    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  async subscribe(userId: string, data: PushSubscriptionData): Promise<void> {
    this.logger.log('Service: subscribe() requested');
    await this.repo.upsertByEndpoint({ ...data, userId });
    this.logger.log('Service: subscribe() done');
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    this.logger.log('Service: unsubscribe() requested');
    const sub = await this.repo.findByEndpoint(endpoint);
    if (sub) {
      if (sub.userId === userId) {
        await this.repo.delete(sub.id);
        this.logger.log('Service: unsubscribe() done');
      } else {
        this.logger.warn('Service: unsubscribe() — endpoint owned by another user, skipping');
      }
    } else {
      this.logger.log('Service: unsubscribe() — nothing found');
    }
  }

  async send(userId: string, payload: PushPayload): Promise<PushResult[]> {
    const subs = await this.repo.findByUserId(userId);
    this.logger.log(
      `Service: send() requested, subscriptionsFound=${subs.length}`,
    );

    if (subs.length === 0) {
      this.logger.warn('Service: send() — no push subscriptions');
      return [];
    }

    const results: PushResult[] = [];

    for (const sub of subs) {
      try {
        this.logger.debug('Service: send() — sending');
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
        results.push({ success: true, endpoint: sub.endpoint });
        this.logger.log('Service: send() — sent successfully');
      } catch (err) {
        const error = err as { statusCode?: number; message?: string; statusMessage?: string };
        if (error.statusCode === 410) {
          this.logger.warn('Service: send() — push subscription expired (410), removing');
          await this.repo.delete(sub.id);
        } else {
          this.logger.error(
            `Service: send() — failed to send push: statusCode=${error.statusCode}, message=${error.message ?? error.statusMessage}`,
          );
        }
        results.push({
          success: false,
          endpoint: sub.endpoint,
          error: error.message ?? error.statusMessage ?? 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Service: send() — done: ${results.filter((r) => r.success).length} sent, ${results.filter((r) => !r.success).length} failed`,
    );
    return results;
  }

  async getUserSubscriptions(userId: string) {
    return this.repo.findByUserId(userId);
  }

  getVapidPublicKey(): string {
    return this.config.getOrThrow('VAPID_PUBLIC_KEY', { infer: true });
  }
}
