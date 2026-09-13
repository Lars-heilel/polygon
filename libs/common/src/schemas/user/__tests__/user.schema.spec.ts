import { userSchema } from '../user.schema';

// UUIDv7 ids arrive from auth-service after the id migration. zod's z.uuid()
// accepts any version, and this spec pins that: narrowing to uuidv4 would
// reject every id generated after the migration.
const V7_ID = '0197f96c-b278-7f64-a32f-d44a57f6726b';

describe('user schema', () => {
  it('accepts UUIDv7 ids', () => {
    const user = userSchema.parse({
      id: V7_ID,
      email: 'a@example.com',
      name: 'a',
      displayName: null,
      avatarUrl: null,
      bio: null,
      createdAt: new Date('2026-09-12T00:00:00.000Z'),
      updatedAt: new Date('2026-09-12T00:00:00.000Z'),
    });

    expect(user.id).toBe(V7_ID);
  });
});
