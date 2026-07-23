import { render, screen } from '@testing-library/react';

import { AvatarCarousel } from '@org/features-upload-avatar';
import { authedFetch } from '@org/shared';

jest.mock('embla-carousel-react', () => ({
  __esModule: true,
  default: () => [
    jest.fn(),
    {
      off: jest.fn(),
      on: jest.fn(),
      reInit: jest.fn(),
      scrollNext: jest.fn(),
      scrollPrev: jest.fn(),
      scrollTo: jest.fn(),
      selectedScrollSnap: jest.fn(() => 0),
    },
  ],
}));

const avatar = {
  id: 'avatar-1',
  url: '/avatar-1.png',
  bucket: 'media',
  key: 'avatars/avatar-1.png',
  originalName: 'avatar-1.png',
  mimeType: 'image/png',
  size: 2048,
  category: 'AVATAR',
  createdAt: '2026-07-23T00:00:00.000Z',
};

describe('AvatarCarousel layout', () => {
  beforeEach(() => {
    jest.mocked(authedFetch).mockReset();
    jest.mocked(authedFetch).mockResolvedValue([avatar]);
  });

  it('uses a compact mobile-first dialog instead of stretching the carousel to the viewport', async () => {
    render(
      <AvatarCarousel
        isOpen
        onClose={jest.fn()}
        userId="user-1"
        readOnly
      />,
    );

    await screen.findByAltText('avatar-1.png');

    const shell = screen.getByText('Avatar History').parentElement?.parentElement;
    const carouselArea = screen.getByRole('button', { name: 'Previous' }).parentElement;

    expect(shell?.className).toContain('h-auto');
    expect(shell?.className).toContain('max-h-[calc(100dvh-2rem)]');
    expect(shell?.className).toContain('w-[calc(100vw-2rem)]');
    expect(carouselArea?.className).toContain('shrink-0');
    expect(carouselArea?.className).not.toContain('flex-1');
  });
});
