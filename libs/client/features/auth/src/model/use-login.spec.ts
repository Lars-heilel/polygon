import { CLIENT_ROUTES } from '@org/common';

import { getPostLoginRedirect } from './use-login';

describe('getPostLoginRedirect', () => {
  it('returns chats for regular logins', () => {
    expect(getPostLoginRedirect('', 'http://localhost:4200')).toEqual({
      type: 'internal',
      to: CLIENT_ROUTES.chats.root,
    });
  });

  it('returns the Admin dev app when login was opened from Admin', () => {
    expect(getPostLoginRedirect('?from=/admin/', 'http://localhost:4200')).toEqual({
      type: 'external',
      href: 'http://localhost:4300/admin/',
    });
  });
});
