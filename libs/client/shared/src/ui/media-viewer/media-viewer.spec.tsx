import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MediaViewer, type MediaViewerItem } from './media-viewer';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class IntersectionObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverStub,
});

Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverStub,
});

class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverStub,
});

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverStub,
});

const items: MediaViewerItem[] = [
  { id: 'image-1', type: 'image', src: '/one.png', alt: 'First image', label: 'First image' },
  { id: 'video-1', type: 'video', src: '/two.mp4', alt: 'Second video', label: 'Second video' },
];

describe('MediaViewer', () => {
  it('renders the selected media, caption, count, and download control', () => {
    render(<MediaViewer isOpen items={items} initialIndex={1} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Close media viewer')).toBeTruthy();
    expect(screen.getByLabelText('Download media')).toBeTruthy();
    expect(screen.getByLabelText('Previous media')).toBeTruthy();
    expect(screen.getByLabelText('Next media')).toBeTruthy();
    expect(screen.getByText('Second video')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByTestId('media-viewer').className).toContain('media-viewer');
    expect(screen.getByTestId('media-viewer-chrome').className).toContain('media-viewer__bar');
  });

  it('closes from button, Escape, and backdrop click', () => {
    const onClose = vi.fn();
    render(<MediaViewer isOpen items={items} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close media viewer'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('media-viewer'));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('supports keyboard navigation labels without changing the public API', () => {
    render(<MediaViewer isOpen items={items} initialIndex={0} onClose={vi.fn()} />);

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'ArrowLeft' });

    expect(screen.getByLabelText('Next media')).toBeTruthy();
    expect(screen.getByLabelText('Previous media')).toBeTruthy();
  });

  it('renders nothing when closed or empty', () => {
    const { rerender } = render(<MediaViewer isOpen={false} items={items} onClose={vi.fn()} />);
    expect(screen.queryByTestId('media-viewer')).toBeNull();

    rerender(<MediaViewer isOpen items={[]} onClose={vi.fn()} />);
    expect(screen.queryByTestId('media-viewer')).toBeNull();
  });
});
