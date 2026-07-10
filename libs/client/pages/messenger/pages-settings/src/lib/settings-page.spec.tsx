import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import type { Role } from '@org/common';
import { useMeQuery } from '@org/entities-user';

import { SettingsPage } from './settings-page';

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
  it.each<Role>(['CREATOR', 'ADMIN'])('shows a full Admin link for %s', (role) => {
    renderSettings(role);

    expect(screen.getByRole('link', { name: 'Admin console' }).getAttribute('href')).toBe('/admin');
  });

  it.each<Role>(['MODERATOR', 'USER'])('hides the Admin link for %s', (role) => {
    renderSettings(role);

    expect(screen.queryByRole('link', { name: 'Admin console' })).toBeNull();
  });
});
