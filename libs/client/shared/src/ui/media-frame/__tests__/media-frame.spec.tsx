import { render, screen } from '@testing-library/react';

import { MediaFrame } from '../media-frame.js';

describe('MediaFrame', () => {
  it('reserves proportional media space before assets load', () => {
    render(
      <MediaFrame
        data-testid="media-frame"
        width={1280}
        height={720}
        maxWidth={320}
      >
        <img alt="Preview" src="/preview.jpg" />
      </MediaFrame>,
    );

    const frame = screen.getByTestId('media-frame');

    expect(frame.getAttribute('style')).toContain('aspect-ratio: 1280 / 720');
    expect(frame.getAttribute('style')).toContain('max-width: 320px');
    expect(screen.getByAltText('Preview')).toBeTruthy();
  });

  it('supports fixed-size media contracts', () => {
    render(
      <MediaFrame
        data-testid="circle-frame"
        fixedSize={200}
        shape="circle"
      />,
    );

    const frame = screen.getByTestId('circle-frame');

    expect(frame.getAttribute('style')).toContain('width: 200px');
    expect(frame.getAttribute('style')).toContain('height: 200px');
    expect(frame.className).toContain('rounded-full');
  });
});
