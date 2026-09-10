import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { LandingPage } from '../landing-page';

function renderLanding(): void {
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  beforeEach(() => {
    document.querySelector('meta[name="robots"]')?.remove();
  });

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
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('restores pre-existing robots content on unmount', () => {
    const existing = document.createElement('meta');
    existing.setAttribute('name', 'robots');
    existing.setAttribute('content', 'index, follow');
    document.head.appendChild(existing);

    const { unmount } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow, noarchive',
    );
    unmount();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index, follow',
    );
  });

  it('removes content attribute when pre-existing meta had none', () => {
    const existing = document.createElement('meta');
    existing.setAttribute('name', 'robots');
    document.head.appendChild(existing);

    const { unmount } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow, noarchive',
    );
    unmount();
    const meta = document.querySelector('meta[name="robots"]');
    expect(meta).not.toBeNull();
    expect(meta?.hasAttribute('content')).toBe(false);
  });
});
