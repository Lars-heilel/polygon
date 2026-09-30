import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AuthLayout } from '../auth-layout';

function renderLayout() {
  return render(
    <MemoryRouter>
      <AuthLayout
        title="Welcome back"
        description="Sign in to your account"
      >
        <div>form goes here</div>
      </AuthLayout>
    </MemoryRouter>,
  );
}

describe('AuthLayout', () => {
  it('renders a home link back to the landing page', () => {
    renderLayout();

    const homeLink = screen.getByRole('link', { name: /polygon home/i });
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('renders the auth background image', () => {
    renderLayout();

    expect(screen.getByTestId('auth-background')).toBeInTheDocument();
  });

  it('renders title, description and children', () => {
    renderLayout();

    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByText('form goes here')).toBeInTheDocument();
  });
});
