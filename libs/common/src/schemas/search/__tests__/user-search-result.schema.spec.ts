import { userSearchResultSchema } from '../user-search-result.schema';

describe('userSearchResultSchema', () => {
  const base = {
    id: '0197f96c-b278-7f64-a32f-d44a57f6726b',
    name: 'alice',
    displayName: null,
    avatarUrl: null,
  };

  it('accepts a minimal result', () => {
    expect(userSearchResultSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a non-uuid id', () => {
    expect(userSearchResultSchema.safeParse({ ...base, id: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects a name longer than 32 characters', () => {
    expect(userSearchResultSchema.safeParse({ ...base, name: 'n'.repeat(33) }).success).toBe(false);
  });

  it('rejects a displayName longer than 64 characters', () => {
    expect(userSearchResultSchema.safeParse({ ...base, displayName: 'd'.repeat(65) }).success).toBe(
      false,
    );
  });

  it('rejects an avatarUrl longer than 2048 characters', () => {
    expect(
      userSearchResultSchema.safeParse({
        ...base,
        avatarUrl: `https://example.test/${'a'.repeat(2048)}`,
      }).success,
    ).toBe(false);
  });
});
