import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAudioPlayerStore } from '../../lib/audio/audio-player.store';
import { GlobalAudioPlayer } from './global-audio-player';

describe('GlobalAudioPlayer', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    });
    useAudioPlayerStore.getState().close();
  });

  it('closes the current track from the player chrome', () => {
    useAudioPlayerStore.getState().playTrack({
      id: 'track-1',
      url: '/audio.mp3',
      title: 'Track title',
      subtitle: 'Audio file',
    });

    render(<GlobalAudioPlayer mode="embedded" />);

    expect(screen.getByTestId('embedded-audio-player')).toBeTruthy();
    expect(screen.getByText('Track title')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Close audio player'));

    expect(screen.queryByTestId('embedded-audio-player')).toBeNull();
    expect(useAudioPlayerStore.getState().currentTrack).toBeNull();
  });

  it('renders embedded mode as a compact single-line top bar', () => {
    useAudioPlayerStore.getState().playTrack({
      id: 'track-1',
      url: '/audio.mp3',
      title: 'Track title',
      subtitle: 'Audio file',
    });

    render(<GlobalAudioPlayer mode="embedded" />);

    expect(screen.getByTestId('embedded-audio-player').className).toContain('h-14');
    expect(screen.getByTestId('audio-player-controls').className).toContain('h-14');
    expect(screen.getByLabelText('Previous audio')).toBeTruthy();
    expect(screen.getByLabelText('Next audio')).toBeTruthy();
    expect(screen.getByText('Track title').className).toContain('text-xs');
    expect(screen.queryByText('Audio file')).toBeNull();
  });

  it('switches between queued audio tracks from the compact controls', () => {
    const queue = [
      { id: 'track-1', url: '/audio-1.mp3', title: 'First track' },
      { id: 'track-2', url: '/audio-2.mp3', title: 'Second track' },
    ];

    useAudioPlayerStore.getState().playTrack(queue[0], queue, 0);

    render(<GlobalAudioPlayer mode="embedded" />);

    fireEvent.click(screen.getByLabelText('Next audio'));
    expect(useAudioPlayerStore.getState().currentTrack?.id).toBe('track-2');
    expect(screen.getByText('Second track')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Previous audio'));
    expect(useAudioPlayerStore.getState().currentTrack?.id).toBe('track-1');
    expect(screen.getByText('First track')).toBeTruthy();
  });

  it('switches queued tracks by current track id when the stored index is stale', () => {
    const queue = [
      { id: 'track-1', url: '/audio-1.mp3', title: 'First track' },
      { id: 'track-2', url: '/audio-2.mp3', title: 'Second track' },
    ];

    useAudioPlayerStore.getState().playTrack(queue[0], queue, 0);
    useAudioPlayerStore.setState({ currentIndex: -1 });

    render(<GlobalAudioPlayer mode="embedded" />);

    fireEvent.click(screen.getByLabelText('Next audio'));

    expect(useAudioPlayerStore.getState().currentTrack?.id).toBe('track-2');
    expect(screen.getByText('Second track')).toBeTruthy();
  });
});
