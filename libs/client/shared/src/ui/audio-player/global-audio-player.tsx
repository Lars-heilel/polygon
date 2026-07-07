import { useEffect, useRef } from 'react';

import { cn } from '../../lib/utils/cn';
import { formatAudioTime, useAudioPlayerStore } from '../../lib/audio/audio-player.store';

interface GlobalAudioPlayerProps {
  mode?: 'floating' | 'embedded';
}

export function GlobalAudioPlayer({ mode = 'floating' }: GlobalAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrack = useAudioPlayerStore((state) => state.currentTrack);
  const currentTime = useAudioPlayerStore((state) => state.currentTime);
  const duration = useAudioPlayerStore((state) => state.duration);
  const status = useAudioPlayerStore((state) => state.status);
  const pendingAutoPlay = useAudioPlayerStore((state) => state.pendingAutoPlay);
  const setAudio = useAudioPlayerStore((state) => state.setAudio);
  const sync = useAudioPlayerStore((state) => state.sync);
  const seekTo = useAudioPlayerStore((state) => state.seekTo);
  const pause = useAudioPlayerStore((state) => state.pause);
  const resume = useAudioPlayerStore((state) => state.resume);
  const clearPendingAutoPlay = useAudioPlayerStore((state) => state.clearPendingAutoPlay);

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
          className={cn(
            mode === 'floating'
              ? 'pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3'
              : 'border-t border-border bg-background/95',
          )}
        >
          <div
            className={cn(
              'pointer-events-auto w-full',
              mode === 'floating' && 'max-w-xl rounded-2xl border border-border shadow-2xl backdrop-blur',
            )}
          >
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={status === 'playing' ? pause : resume}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90"
            >
              {status === 'playing' ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{currentTrack.title}</p>
              <p className="truncate text-xs text-text-muted">{currentTrack.subtitle ?? 'Audio'}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="w-9 shrink-0 text-[11px] tabular-nums text-text-muted">
                  {formatAudioTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(event) => seekTo(Number(event.target.value))}
                  className={cn(
                    'h-1 w-full cursor-pointer appearance-none rounded-full bg-border',
                    '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
                  )}
                />
                <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-text-muted">
                  {formatAudioTime(duration)}
                </span>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}
    </>
  );
}
