import { render, screen } from '@testing-library/react';

import { BrandIcon } from '../brand-icon';

const SRC = '/icons/react.svg';

describe('BrandIcon', () => {
  it('renders a decorative image hidden from assistive tech by default', () => {
    render(<BrandIcon src={SRC} />);

    const img = screen.getByRole('presentation', { hidden: true });
    expect(img.getAttribute('src')).toBe(SRC);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });

  it('exposes a meaningful image when alt is provided', () => {
    render(
      <BrandIcon
        src={SRC}
        alt="React logo"
      />,
    );

    const img = screen.getByRole('img', { name: 'React logo' });
    expect(img.getAttribute('aria-hidden')).toBeNull();
  });

  it('applies the requested size and merges className', () => {
    render(
      <BrandIcon
        src={SRC}
        size="sm"
        className="text-primary"
      />,
    );

    const img = screen.getByRole('presentation', { hidden: true });
    expect(img.className).toContain('h-4 w-4');
    expect(img.className).toContain('text-primary');
  });
});
