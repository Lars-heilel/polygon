import { createUserEventSchema } from '../create-user-event.schema';
import { updateUserSchema } from '../update-user.schema';
import { userSchema } from '../user.schema';

const V7_ID = '0197f96c-b278-7f64-a32f-d44a57f6726b';

describe('user contract limits', () => {
  it('rejects a name longer than 32 characters', () => {
    expect(
      userSchema.safeParse({
        id: V7_ID,
        email: 'a@example.com',
        name: 'n'.repeat(33),
        displayName: null,
        avatarUrl: null,
        bio: null,
        createdAt: new Date('2026-09-13T00:00:00.000Z'),
        updatedAt: new Date('2026-09-13T00:00:00.000Z'),
      }).success,
    ).toBe(false);
  });

  it('rejects an email longer than 254 characters', () => {
    expect(
      createUserEventSchema.safeParse({
        id: V7_ID,
        email: `${'a'.repeat(250)}@ex.com`,
        name: 'alice',
      }).success,
    ).toBe(false);
  });

  it('rejects a one-character event name', () => {
    expect(
      createUserEventSchema.safeParse({ id: V7_ID, email: 'a@example.com', name: 'a' }).success,
    ).toBe(false);
  });

  it('rejects a displayName longer than 64 characters', () => {
    expect(updateUserSchema.safeParse({ displayName: 'd'.repeat(65) }).success).toBe(false);
  });

  it('rejects an avatarUrl longer than 2048 characters', () => {
    expect(
      updateUserSchema.safeParse({ avatarUrl: `https://example.test/${'a'.repeat(2048)}` })
        .success,
    ).toBe(false);
  });

  it('keeps bio capped at 500 characters', () => {
    expect(updateUserSchema.safeParse({ bio: 'b'.repeat(501) }).success).toBe(false);
  });
});
