import { CLIENT_ROUTES } from '@org/common';

import { getPostLoginRedirect } from '../use-login';

describe('getPostLoginRedirect', () => {
  it('returns chats for regular logins', () => {
    expect(getPostLoginRedirect()).toBe(CLIENT_ROUTES.chats.root);
  });

  it('returns the guarded page the user came from', () => {
    expect(getPostLoginRedirect('/chats/abc')).toBe('/chats/abc');
    expect(getPostLoginRedirect(CLIENT_ROUTES.profile.root)).toBe(CLIENT_ROUTES.profile.root);
  });

  it('ignores auth pages and external urls', () => {
    expect(getPostLoginRedirect(CLIENT_ROUTES.auth.login)).toBe(CLIENT_ROUTES.chats.root);
    expect(getPostLoginRedirect('https://evil.test')).toBe(CLIENT_ROUTES.chats.root);
  });
});
