import { render, screen } from '@testing-library/react';

import { LinkPreviewCard, MessageContent } from '@org/entities-message';
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

    expect(screen.getByTestId('link-preview-card').className).toContain('w-full');
    expect(screen.getByTestId('link-preview-card').className).toContain('max-w-80');
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

    expect(screen.getByTestId('link-preview-card').className).toContain('w-full');
    expect(screen.getByTestId('link-preview-card').className).toContain('max-w-80');
    expect(screen.getByTestId('link-preview-body').className).toContain('min-h-[96px]');
    expect(screen.getByText('example.com')).toBeTruthy();
  });

  it('keeps link messages and previews on the same portable width contract', () => {
    __setLinkPreviewStub({
      url: 'https://www.youtube.com/watch?v=YJoxtfHoGdU&list=RDYJoxtfHoGdU&start_radio=1',
      canonicalUrl: null,
      title: 'YouTube',
      description: null,
      imageUrl: 'https://example.com/youtube.jpg',
      siteName: 'YouTube',
      hostname: 'www.youtube.com',
    });

    render(
      <MessageContent
        text="https://www.youtube.com/watch?v=YJoxtfHoGdU&list=RDYJoxtfHoGdU&start_radio=1"
        isMine
      />,
    );

    expect(screen.getByTestId('message-content').className).toContain('max-w-80');
    expect(screen.getByTestId('message-text').className).toContain('block');
    expect(screen.getByTestId('link-preview-card').className).toContain('w-full');
    expect(screen.getByTestId('link-preview-card').className).toContain('max-w-80');
  });
});
