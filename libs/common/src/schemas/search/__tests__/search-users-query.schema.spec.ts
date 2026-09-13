import { searchUsersQuerySchema } from '../search-users-query.schema';

describe('searchUsersQuerySchema', () => {
  it('applies defaults', () => {
    expect(searchUsersQuerySchema.parse({ q: 'alice' })).toEqual({
      q: 'alice',
      limit: 20,
      offset: 0,
    });
  });

  it('accepts a single-character query', () => {
    expect(searchUsersQuerySchema.safeParse({ q: 'a' }).success).toBe(true);
  });

  it('rejects an empty query', () => {
    expect(searchUsersQuerySchema.safeParse({ q: '' }).success).toBe(false);
  });

  it('rejects a query longer than 128 characters', () => {
    expect(searchUsersQuerySchema.safeParse({ q: 'a'.repeat(129) }).success).toBe(false);
  });

  it('rejects a limit above 50', () => {
    expect(searchUsersQuerySchema.safeParse({ q: 'alice', limit: 51 }).success).toBe(false);
  });
});
