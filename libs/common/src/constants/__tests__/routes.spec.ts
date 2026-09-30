import { CLIENT_ROUTES } from '../routes';

describe('CLIENT_ROUTES (variant A: profile/settings are top-level)', () => {
  it('exposes top-level profile routes', () => {
    expect(CLIENT_ROUTES.profile.root).toBe('/profile');
    expect(CLIENT_ROUTES.profile.edit).toBe('/profile/edit');
  });

  it('exposes settings as an object with root (not a bare string)', () => {
    expect(CLIENT_ROUTES.settings.root).toBe('/settings');
  });

  it('keeps chats routes without collisions with profile/settings', () => {
    expect(CLIENT_ROUTES.chats.root).toBe('/chats');
    expect(CLIENT_ROUTES.chats.byId('abc')).toBe('/chats/abc');

    const chatUrl = CLIENT_ROUTES.chats.byId('settings');
    // dynamic chat urls must never equal a static top-level route
    expect(chatUrl).not.toBe(CLIENT_ROUTES.settings.root);
  });

  it('exposes landing and root', () => {
    expect(CLIENT_ROUTES.landing).toBe('/landing');
    expect(CLIENT_ROUTES.root).toBe('/');
  });
});
