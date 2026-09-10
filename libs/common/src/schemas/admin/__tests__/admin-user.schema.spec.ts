import { adminUserListItemSchema } from '../admin-user.schema';

describe('adminUserListItemSchema', () => {
  it('composes the search result with Admin role and ban state', () => {
    const searchResult = {
      id: '8fd79b7d-d3f2-4c66-96c4-61881bc80767',
      name: 'alice',
      displayName: 'Alice',
      avatarUrl: null,
    };

    expect(
      adminUserListItemSchema.parse({
        ...searchResult,
        role: 'ADMIN',
        ban: {
          isBanned: false,
          bannedUntil: null,
          banReason: null,
          bannedAt: null,
          bannedBy: null,
        },
      }),
    ).toEqual({
      ...searchResult,
      role: 'ADMIN',
      ban: {
        isBanned: false,
        bannedUntil: null,
        banReason: null,
        bannedAt: null,
        bannedBy: null,
      },
    });
  });
});
