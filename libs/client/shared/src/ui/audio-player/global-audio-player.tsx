import { useEffect, useRef } from 'react';

import { cn } from '../../lib/utils/cn';
import { formatAudioTime, useAudioPlayerStore } from '../../lib/audio/audio-player.store';

interface GlobalAudioPlayerProps {
  mode?: 'floating' | 'embedded';
  className?: string;
}

export function GlobalAudioPlayer({ mode = 'floating', className }: GlobalAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrack = useAudioPlayerStore((state) => state.currentTrack);
  const queue = useAudioPlayerStore((state) => state.queue);
  const currentIndex = useAudioPlayerStore((state) => state.currentIndex);
  const currentTime = useAudioPlayerStore((state) => state.currentTime);
  const duration = useAudioPlayerStore((state) => state.duration);
  const status = useAudioPlayerStore((state) => state.status);
  const pendingAutoPlay = useAudioPlayerStore((state) => state.pendingAutoPlay);
  const setAudio = useAudioPlayerStore((state) => state.setAudio);
  const sync = useAudioPlayerStore((state) => state.sync);
  const seekTo = useAudioPlayerStore((state) => state.seekTo);
  const pause = useAudioPlayerStore((state) => state.pause);
  const resume = useAudioPlayerStore((state) => state.resume);
  const playPrev = useAudioPlayerStore((state) => state.playPrev);
  const playNext = useAudioPlayerStore((state) => state.playNext);
  const close = useAudioPlayerStore((state) => state.close);
  const clearPendingAutoPlay = useAudioPlayerStore((state) => state.clearPendingAutoPlay);
  const resolvedCurrentIndex = currentIndex >= 0
    ? currentIndex
    : currentTrack ? queue.findIndex((track) => track.id === currentTrack.id) : -1;
  const canPlayPrev = resolvedCurrentIndex > 0;
  const canPlayNext = resolvedCurrentIndex >= 0 && resolvedCurrentIndex < queue.length - 1;

  useEffect(() => {
    setAudio(audioRef.current);
    return () => {
      setAudio(null);
    };
  }, [setAudio]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (audio.getAttribute('src') !== currentTrack.url) {
      audio.setAttribute('src', currentTrack.url);
      audio.load?.();
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack || !pendingAutoPlay) return;

    const startPlayback = () => {
      void audio.play().catch(() => {
        sync({ status: 'paused' });
      }).finally(() => {
        clearPendingAutoPlay();
      });
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      startPlayback();
      return;
    }

    audio.addEventListener('loadedmetadata', startPlayback, { once: true });
    return () => {
      audio.removeEventListener('loadedmetadata', startPlayback);
    };
  }, [clearPendingAutoPlay, currentTrack, pendingAutoPlay, sync]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.subtitle ?? 'Polygon',
      album: 'Polygon',
    });
    navigator.mediaSession.setActionHandler('play', resume);
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        seekTo(details.seekTime);
      }
    });
  }, [currentTrack, pause, resume, seekTo]);

  return (
    <>
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => {
          sync({ currentTime: event.currentTarget.currentTime });
        }}
        onLoadedMetadata={(event) => {
          sync({ duration: event.currentTarget.duration || 0 });
        }}
        onPlay={() => sync({ status: 'playing' })}
        onPause={() => sync({ status: 'paused' })}
        onEnded={() => sync({ status: 'paused', currentTime: 0 })}
      />
      {currentTrack && (
        <div
          data-testid={`${mode}-audio-player`}
          className={cn(
            mode === 'floating'
              ? 'pointer-events-none fixed inset-x-0 top-0 z-50 flex h-14 justify-center border-b border-border bg-background/95 px-2 backdrop-blur'
              : 'h-14 border-b border-border bg-background/95',
            className,
          )}
        >
          <div
            className={cn(
              'pointer-events-auto w-full',
              mode === 'floating' && 'max-w-5xl',
            )}
          >
            <div data-testid="audio-player-controls" className="flex h-14 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
              <button
                type="button"
                aria-label="Previous audio"
                onClick={playPrev}
                disabled={!canPlayPrev}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-elevated hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent sm:flex"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6V6zm3 6 9-6v12l-9-6z" />
                </svg>
              </button>
              <button
                type="button"
                aria-label={status === 'playing' ? 'Pause audio' : 'Play audio'}
                onClick={status === 'playing' ? pause : resume}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover"
              >
                {status === 'playing' ? (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                aria-label="Next audio"
                onClick={playNext}
                disabled={!canPlayNext}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-elevated hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent sm:flex"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 6h2v12h-2V6zM6 18V6l9 6-9 6z" />
                </svg>
              </button>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                <p className="truncate text-xs font-medium text-text">
                  {currentTrack.title}
                </p>
                <div className="relative flex h-6 items-center">
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary"
                      style={{ width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
                    />
                  </div>
                  <div
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-primary shadow"
                    style={{ left: `calc(${(duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0).toFixed(2)}% - 7px)` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(event) => seekTo(Number(event.target.value))}
                    aria-label="Seek audio"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
              </div>
              <span className="hidden w-9 shrink-0 text-right text-[11px] tabular-nums text-text-muted sm:block">
                {formatAudioTime(currentTime)}
              </span>
              <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-text-muted">
                {formatAudioTime(duration)}
              </span>
              <button
                type="button"
                aria-label="Close audio player"
                onClick={close}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
