import { sendPushSchema } from '../send-push.schema';

describe('sendPushSchema', () => {
  const base = {
    userId: '0197f96c-b278-7f64-a32f-d44a57f6726b',
    title: 'New message',
    body: 'Hello',
  };

  it('accepts a minimal payload', () => {
    expect(sendPushSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a title longer than 128 characters', () => {
    expect(sendPushSchema.safeParse({ ...base, title: 't'.repeat(129) }).success).toBe(false);
  });

  it('rejects a body longer than 512 characters', () => {
    expect(sendPushSchema.safeParse({ ...base, body: 'b'.repeat(513) }).success).toBe(false);
  });

  it('rejects an unknown eventType', () => {
    expect(sendPushSchema.safeParse({ ...base, eventType: 'SMS' }).success).toBe(false);
  });
});
