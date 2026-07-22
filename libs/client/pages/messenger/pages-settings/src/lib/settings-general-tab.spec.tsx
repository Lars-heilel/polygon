import { render, screen } from '@testing-library/react';

import { useNotificationStore } from '@org/features-notifications';

import { SettingsGeneralTab } from './settings-general-tab';

jest.mock('@org/features-notifications', () => ({
  useNotificationStore: jest.fn(),
}));

const mockedUseNotificationStore = jest.mocked(useNotificationStore);

describe('SettingsGeneralTab', () => {
  beforeEach(() => {
    mockedUseNotificationStore.mockReturnValue({
      isMuted: false,
      setMuted: jest.fn(),
    } as unknown as ReturnType<typeof useNotificationStore>);
  });

  it('does not expose language controls while localization is disabled', () => {
    render(<SettingsGeneralTab />);

    expect(screen.queryByText('Language')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
