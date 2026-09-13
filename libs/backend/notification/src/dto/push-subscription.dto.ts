import { pushSubscriptionSchema, pushUnsubscribeEventSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class SubscribePushDto extends createZodDto(pushSubscriptionSchema) {}
export class UnsubscribePushDto extends createZodDto(
  pushUnsubscribeEventSchema.pick({ endpoint: true }),
) {}
