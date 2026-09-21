import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { SettingsPage } from '../settings-page';

jest.mock('../settings-devices-tab', () => ({
  SettingsDevicesTab: () => <div>Devices</div>,
}));

jest.mock('../settings-general-tab', () => ({
  SettingsGeneralTab: () => <div>General</div>,
}));

jest.mock('../settings-privacy-tab', () => ({
  SettingsPrivacyTab: () => <div>Privacy</div>,
}));

function renderSettings() {
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  it('renders settings tabs', () => {
    renderSettings();

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'general' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'devices' })).toBeTruthy();
  });

  it('does not expose the privacy settings tab while the section is disabled', () => {
    renderSettings();

    expect(screen.queryByRole('button', { name: /privacy/i })).toBeNull();
  });
});
