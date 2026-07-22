import { render, screen } from '@testing-library/react';

import { LinkPreviewCard } from '@org/entities-message';
import { __setLinkPreviewStub, __resetLinkPreviewStub } from '../test-stubs/shared';

describe('LinkPreviewCard', () => {
  beforeEach(() => {
    __resetLinkPreviewStub();
  });

  it('renders image previews with a stable size contract', () => {
    __setLinkPreviewStub({
      url: 'https://example.com/article',
      canonicalUrl: null,
      title: 'Long article title',
      description: 'Long description',
      imageUrl: 'https://example.com/image.jpg',
      siteName: 'Example',
      hostname: 'example.com',
    });

    render(<LinkPreviewCard url="https://example.com/article" />);

    expect(screen.getByTestId('link-preview-card').className).toContain('w-[min(100%,320px)]');
    expect(screen.getByTestId('link-preview-card').className).toContain('max-h-[236px]');
    expect(screen.getByTestId('link-preview-image').className).toContain('h-28');
    expect(screen.getByTestId('link-preview-body').className).toContain('min-h-[96px]');
  });

  it('renders text-only previews with the same body size contract', () => {
    __setLinkPreviewStub({
      url: 'https://example.com/article',
      canonicalUrl: null,
      title: 'Title',
      description: null,
      imageUrl: null,
      siteName: null,
      hostname: 'example.com',
    });

    render(<LinkPreviewCard url="https://example.com/article" isMine />);

    expect(screen.getByTestId('link-preview-card').className).toContain('w-[min(100%,320px)]');
    expect(screen.getByTestId('link-preview-body').className).toContain('min-h-[96px]');
    expect(screen.getByText('example.com')).toBeTruthy();
  });
});
