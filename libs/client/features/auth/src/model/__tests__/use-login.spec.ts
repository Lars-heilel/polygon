import { CLIENT_ROUTES } from '@org/common';

import { getPostLoginRedirect } from '../use-login';

describe('getPostLoginRedirect', () => {
  it('returns chats for regular logins', () => {
    expect(getPostLoginRedirect()).toEqual({
      type: 'internal',
      to: CLIENT_ROUTES.chats.root,
    });
  });
});
