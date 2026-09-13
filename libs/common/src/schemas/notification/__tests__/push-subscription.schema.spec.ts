import { pushSubscribeEventSchema, pushSubscriptionSchema } from '../push-subscription.schema';

describe('pushSubscriptionSchema', () => {
  it('accepts a valid subscription', () => {
    expect(
      pushSubscriptionSchema.safeParse({
        endpoint: 'https://push.example.test/a',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      }).success,
    ).toBe(true);
  });

  it('rejects an endpoint longer than 2048 characters', () => {
    expect(
      pushSubscriptionSchema.safeParse({
        endpoint: `https://push.example.test/${'a'.repeat(2048)}`,
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      }).success,
    ).toBe(false);
  });

  it('rejects keys longer than 128 characters', () => {
    expect(
      pushSubscriptionSchema.safeParse({
        endpoint: 'https://push.example.test/a',
        p256dh: 'k'.repeat(129),
        auth: 'auth-key',
      }).success,
    ).toBe(false);
  });
});

describe('pushSubscribeEventSchema', () => {
  it('requires a uuid userId', () => {
    expect(
      pushSubscribeEventSchema.safeParse({
        userId: 'not-a-uuid',
        subscription: {
          endpoint: 'https://push.example.test/a',
          p256dh: 'k',
          auth: 'a',
        },
      }).success,
    ).toBe(false);
  });

  it('accepts a uuidv7 userId', () => {
    expect(
      pushSubscribeEventSchema.safeParse({
        userId: '0197f96c-b278-7f64-a32f-d44a57f6726b',
        subscription: {
          endpoint: 'https://push.example.test/a',
          p256dh: 'k',
          auth: 'a',
        },
      }).success,
    ).toBe(true);
  });
});
