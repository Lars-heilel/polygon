import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { LandingPage } from './landing-page';

function renderLanding(): void {
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  it('renders single h1, landmarks and CTA links', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Fast, private messenger for teams',
    );
    expect(screen.getByRole('navigation', { name: 'Landing' })).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open messenger' })).toHaveAttribute(
      'href',
      '/chats',
    );
  });

  it('sets robots noindex while mounted', () => {
    const { unmount } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow, noarchive',
    );
    unmount();
  });
});
