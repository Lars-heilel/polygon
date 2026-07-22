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
});
