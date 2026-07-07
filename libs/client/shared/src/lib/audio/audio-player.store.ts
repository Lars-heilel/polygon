import { useCallback } from 'react';

import { create } from 'zustand';

export interface AudioTrack {
  id: string;
  url: string;
  title: string;
  subtitle?: string | null;
}

type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused';

interface AudioPlayerState {
  audio: HTMLAudioElement | null;
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  currentIndex: number;
  currentTime: number;
  duration: number;
  status: PlayerStatus;
  pendingAutoPlay: boolean;
  setAudio: (audio: HTMLAudioElement | null) => void;
  toggleTrack: (track: AudioTrack, queue?: AudioTrack[], index?: number) => void;
  playTrack: (track: AudioTrack, queue?: AudioTrack[], index?: number) => void;
  pause: () => void;
  resume: () => void;
  seekTo: (time: number) => void;
  playPrev: () => void;
  playNext: () => void;
  sync: (patch: Partial<Pick<AudioPlayerState, 'currentTime' | 'duration' | 'status'>>) => void;
  clearPendingAutoPlay: () => void;
}

export const useAudioPlayerStore = create<AudioPlayerState>((set, get) => ({
  audio: null,
  currentTrack: null,
  queue: [],
  currentIndex: -1,
  currentTime: 0,
  duration: 0,
  status: 'idle',
  pendingAutoPlay: false,
  setAudio: (audio) => set({ audio }),
  toggleTrack: (track, queue, index) => {
    const { currentTrack, status } = get();
    if (currentTrack?.id === track.id) {
      if (status === 'playing') {
        get().pause();
      } else {
        get().resume();
      }
      return;
    }

    get().playTrack(track, queue, index);
  },
  playTrack: (track, queue, index) => {
    const { audio, currentTrack } = get();
    const resolvedQueue = queue && queue.length > 0 ? queue : [track];
    const resolvedIndex = typeof index === 'number'
      ? index
      : Math.max(0, resolvedQueue.findIndex((item) => item.id === track.id));

    set({
      currentTrack: track,
      queue: resolvedQueue,
      currentIndex: resolvedIndex,
      currentTime: currentTrack?.id === track.id ? get().currentTime : 0,
      duration: currentTrack?.id === track.id ? get().duration : 0,
      status: 'loading',
      pendingAutoPlay: true,
    });

    if (audio) {
      if (audio.src !== track.url) {
        audio.src = track.url;
      }

      void audio.play().catch(() => {
        set({ status: 'paused' });
      });
    }
  },
  pause: () => {
    get().audio?.pause();
    set({ status: 'paused', pendingAutoPlay: false });
  },
  resume: () => {
    const { audio, currentTrack } = get();
    if (!audio || !currentTrack) return;

    if (audio.src !== currentTrack.url) {
      audio.src = currentTrack.url;
    }

    set({ status: 'loading', pendingAutoPlay: true });
    void audio.play().catch(() => {
      set({ status: 'paused' });
    });
  },
  seekTo: (time) => {
    const audio = get().audio;
    if (!audio) return;
    audio.currentTime = time;
    set({ currentTime: time });
  },
  playPrev: () => {
    const { queue, currentIndex } = get();
    if (currentIndex <= 0 || queue.length === 0) return;
    const nextIndex = currentIndex - 1;
    const track = queue[nextIndex];
    if (!track) return;
    get().playTrack(track, queue, nextIndex);
  },
  playNext: () => {
    const { queue, currentIndex } = get();
    if (currentIndex < 0 || currentIndex >= queue.length - 1) return;
    const nextIndex = currentIndex + 1;
    const track = queue[nextIndex];
    if (!track) return;
    get().playTrack(track, queue, nextIndex);
  },
  sync: (patch) => set(patch),
  clearPendingAutoPlay: () => set({ pendingAutoPlay: false }),
}));

export function useAudioTrack(track: AudioTrack, options?: { queue?: AudioTrack[]; index?: number }) {
  const currentTrack = useAudioPlayerStore((state) => state.currentTrack);
  const status = useAudioPlayerStore((state) => state.status);
  const currentTime = useAudioPlayerStore((state) => state.currentTime);
  const duration = useAudioPlayerStore((state) => state.duration);
  const toggleTrack = useAudioPlayerStore((state) => state.toggleTrack);
  const seekTo = useAudioPlayerStore((state) => state.seekTo);

  const isCurrent = currentTrack?.id === track.id;
  const isPlaying = isCurrent && status === 'playing';
  const resolvedCurrentTime = isCurrent ? currentTime : 0;
  const resolvedDuration = isCurrent ? duration : 0;

  const toggle = useCallback(() => {
    toggleTrack(track, options?.queue, options?.index);
  }, [options?.index, options?.queue, toggleTrack, track]);

  const seek = useCallback(
    (nextTime: number) => {
      if (!isCurrent) return;
      seekTo(nextTime);
    },
    [isCurrent, seekTo],
  );

  return {
    isCurrent,
    isPlaying,
    currentTime: resolvedCurrentTime,
    duration: resolvedDuration,
    toggle,
    seek,
  };
}

export function formatAudioTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
