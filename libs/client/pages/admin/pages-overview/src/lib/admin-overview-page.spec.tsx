import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

import { AdminOverviewPage } from './admin-overview-page';

describe('AdminOverviewPage', () => {
  it('links to user administration and back to messenger', () => {
    render(
      <MemoryRouter>
        <AdminOverviewPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Admin console' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Manage users' }).getAttribute('href')).toBe('/users');
    expect(screen.getByRole('link', { name: 'Back to messenger' }).getAttribute('href')).toBe('/');
  });

  it('submits a direct user search to the users page query string', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminOverviewPage />
        <LocationProbe />
      </MemoryRouter>,
    );

    await user.type(screen.getByRole('textbox', { name: 'Search users' }), 'alice');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByLabelText('Current location').textContent).toBe('/users?query=alice');
  });
});

function LocationProbe() {
  const location = useLocation();

  return <output aria-label="Current location">{`${location.pathname}${location.search}`}</output>;
}
