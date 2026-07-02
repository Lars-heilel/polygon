export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPushSubscriptionRepository {
  findByUserId(userId: string): Promise<PushSubscriptionRecord[]>;
  findByEndpoint(endpoint: string): Promise<PushSubscriptionRecord | null>;
  create(data: PushSubscriptionData & { userId: string }): Promise<PushSubscriptionRecord>;
  delete(id: string): Promise<void>;
  deleteByEndpoint(endpoint: string): Promise<void>;
}

export type NotificationEventType = 'MESSAGE' | 'CALL_INCOMING' | 'CALL_MISSED';

export interface PushPayload {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
  tag?: string;
  eventType?: NotificationEventType;
}
