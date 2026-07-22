import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import type { Role } from '@org/common';
import { useMeQuery } from '@org/entities-user';

import { SettingsPage, getAdminConsoleHref } from './settings-page';

jest.mock('./settings-devices-tab', () => ({
  SettingsDevicesTab: () => <div>Devices</div>,
}));

jest.mock('./settings-general-tab', () => ({
  SettingsGeneralTab: () => <div>General</div>,
}));

jest.mock('./settings-privacy-tab', () => ({
  SettingsPrivacyTab: () => <div>Privacy</div>,
}));

jest.mock('@org/entities-user', () => ({
  useMeQuery: jest.fn(),
}));

const mockedUseMeQuery = jest.mocked(useMeQuery);

function renderSettings(role: Role) {
  mockedUseMeQuery.mockReturnValue({
    data: { id: 'me', role },
  } as unknown as ReturnType<typeof useMeQuery>);

  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('SettingsPage Admin link', () => {
  it('points from the messenger dev server to the admin dev server', () => {
    expect(getAdminConsoleHref('http://localhost:4200')).toBe('http://localhost:4300/admin/');
    expect(getAdminConsoleHref('http://127.0.0.1:4200')).toBe('http://127.0.0.1:4300/admin/');
  });

  it('uses the same-origin admin route outside the split dev server', () => {
    expect(getAdminConsoleHref('https://demo.example.com')).toBe('/admin/');
  });

  it.each<Role>(['CREATOR', 'ADMIN'])('shows a full Admin link for %s', (role) => {
    renderSettings(role);

    expect(screen.getByRole('link', { name: 'Admin console' }).getAttribute('href')).toBe('/admin/');
  });

  it.each<Role>(['MODERATOR', 'USER'])('hides the Admin link for %s', (role) => {
    renderSettings(role);

    expect(screen.queryByRole('link', { name: 'Admin console' })).toBeNull();
  });

  it('does not expose the privacy settings tab while the section is disabled', () => {
    renderSettings('USER');

    expect(screen.queryByRole('button', { name: /privacy/i })).toBeNull();
  });
});
