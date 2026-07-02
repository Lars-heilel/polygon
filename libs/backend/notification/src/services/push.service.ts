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
    this.logger.log(`Service: subscribe() userId=${userId}, endpoint=${data.endpoint.slice(0, 50)}...`);
    const existing = await this.repo.findByEndpoint(data.endpoint);
    if (existing) {
      this.logger.debug({ existingId: existing.id, existingUserId: existing.userId }, 'Service: subscribe() — found existing subscription');
      if (existing.userId !== userId) {
        this.logger.warn(`Service: subscribe() — endpoint owned by different userId=${existing.userId}, reassigning to userId=${userId}`);
        await this.repo.delete(existing.id);
      } else {
        this.logger.log(`Service: subscribe() — already subscribed for userId=${userId}`);
        return;
      }
    }
    const created = await this.repo.create({ ...data, userId });
    this.logger.log(`Service: subscribe() — saved push subscription id=${created.id} for userId=${userId}`);
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    this.logger.log(`Service: unsubscribe() userId=${userId}, endpoint=${endpoint.slice(0, 50)}...`);
    const sub = await this.repo.findByEndpoint(endpoint);
    if (sub) {
      if (sub.userId === userId) {
        await this.repo.delete(sub.id);
        this.logger.log(`Service: unsubscribe() — removed subscription id=${sub.id} for userId=${userId}`);
      } else {
        this.logger.warn(`Service: unsubscribe() — endpoint belongs to different userId=${sub.userId}, not removing`);
      }
    } else {
      this.logger.log(`Service: unsubscribe() — no subscription found for endpoint`);
    }
  }

  async send(userId: string, payload: PushPayload): Promise<PushResult[]> {
    const subs = await this.repo.findByUserId(userId);
    this.logger.log(`Service: send() userId=${userId}, subscriptionsFound=${subs.length}`);

    if (subs.length === 0) {
      this.logger.warn(`Service: send() — no push subscriptions for userId=${userId}`);
      return [];
    }

    const results: PushResult[] = [];

    for (const sub of subs) {
      try {
        this.logger.debug(`Service: send() — sending to endpoint=${sub.endpoint.slice(0, 50)}...`);
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
        results.push({ success: true, endpoint: sub.endpoint });
        this.logger.log(`Service: send() — sent successfully to ${sub.endpoint.slice(0, 50)}...`);
      } catch (err) {
        const error = err as { statusCode?: number; message?: string; statusMessage?: string };
        if (error.statusCode === 410) {
          this.logger.warn(`Service: send() — push subscription expired (410), removing: ${sub.endpoint.slice(0, 50)}...`);
          await this.repo.delete(sub.id);
        } else {
          this.logger.error(
            `Service: send() — failed to send push to ${sub.endpoint.slice(0, 50)}...: statusCode=${error.statusCode}, message=${error.message ?? error.statusMessage}`,
          );
        }
        results.push({
          success: false,
          endpoint: sub.endpoint,
          error: error.message ?? error.statusMessage ?? 'Unknown error',
        });
      }
    }

    this.logger.log(`Service: send() — done for userId=${userId}: ${results.filter((r) => r.success).length} sent, ${results.filter((r) => !r.success).length} failed`);
    return results;
  }

  async getUserSubscriptions(userId: string) {
    return this.repo.findByUserId(userId);
  }

  getVapidPublicKey(): string {
    return this.config.getOrThrow('VAPID_PUBLIC_KEY', { infer: true });
  }
}
