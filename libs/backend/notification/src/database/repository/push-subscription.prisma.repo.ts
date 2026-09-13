import { Injectable } from '@nestjs/common';

import type {
  IPushSubscriptionRepository,
  PushSubscriptionData,
  PushSubscriptionRecord,
} from '../../interfaces/notification.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushSubscriptionPrismaRepository implements IPushSubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<PushSubscriptionRecord[]> {
    return this.prisma.pushSubscription.findMany({ where: { userId } });
  }

  async findByEndpoint(endpoint: string): Promise<PushSubscriptionRecord | null> {
    return this.prisma.pushSubscription.findUnique({ where: { endpoint } });
  }

  async create(data: PushSubscriptionData & { userId: string }): Promise<PushSubscriptionRecord> {
    return this.prisma.pushSubscription.create({ data });
  }

  async upsertByEndpoint(
    data: PushSubscriptionData & { userId: string },
  ): Promise<PushSubscriptionRecord> {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      update: { userId: data.userId, p256dh: data.p256dh, auth: data.auth },
      create: data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.pushSubscription.delete({ where: { id } });
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }
}
