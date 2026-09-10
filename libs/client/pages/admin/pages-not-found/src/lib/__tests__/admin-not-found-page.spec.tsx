import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { AdminNotFoundPage } from '../admin-not-found-page';

describe('AdminNotFoundPage', () => {
  it('renders an admin-local not found page with a return link', () => {
    render(
      <MemoryRouter>
        <AdminNotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Admin page not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to admin overview' }).getAttribute('href')).toBe('/');
  });
});
