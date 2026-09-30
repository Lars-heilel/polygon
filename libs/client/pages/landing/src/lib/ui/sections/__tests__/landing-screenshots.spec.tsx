import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { LandingScreenshots } from '../landing-screenshots';

describe('LandingScreenshots', () => {
  it('renders the first slide with caption and controls', () => {
    render(<LandingScreenshots />);

    expect(screen.getByRole('heading', { name: /screenshots/i })).toBeInTheDocument();
    expect(screen.getByAltText('Polygon messenger on desktop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous screenshot/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next screenshot/i })).toBeInTheDocument();
  });

  it('renders one dot per slide', () => {
    render(<LandingScreenshots />);

    expect(screen.getAllByRole('button', { name: /go to screenshot \d+/i })).toHaveLength(2);
  });

  it('advances to the next slide on next click and wraps around', async () => {
    const user = userEvent.setup();
    render(<LandingScreenshots />);

    expect(screen.getByAltText('Polygon messenger on desktop')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next screenshot/i }));
    expect(screen.getByAltText('Polygon messenger on mobile')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next screenshot/i }));
    expect(screen.getByAltText('Polygon messenger on desktop')).toBeInTheDocument();
  });

  it('jumps to a slide on dot click', async () => {
    const user = userEvent.setup();
    render(<LandingScreenshots />);

    await user.click(screen.getByRole('button', { name: /go to screenshot 2/i }));
    expect(screen.getByAltText('Polygon messenger on mobile')).toBeInTheDocument();
  });
});
