import type { ReactNode } from 'react';

export function Avatar({ name }: { name?: string | null }) {
  return <div data-testid="avatar">{name}</div>;
}

export function Spinner() {
  return <div role="status">Loading</div>;
}

export async function authedFetch<T>(): Promise<T> {
  throw new Error('authedFetch is not implemented in tests');
}

export function frontendLog() {
  /* no-op */
}

export const socket = {
  emit: () => undefined,
};

export function formatTime(value: string) {
  return value;
}

export function formatAudioTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

interface AudioTrackStub {
  id: string;
  url: string;
  title: string;
  subtitle?: string | null;
}

interface AudioTrackCall {
  track: AudioTrackStub;
  options?: { queue?: AudioTrackStub[]; index?: number };
}

const audioTrackCalls: AudioTrackCall[] = [];

export function useAudioTrack(track: AudioTrackStub, options?: AudioTrackCall['options']) {
  audioTrackCalls.push({ track, options });

  return {
    isCurrent: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    toggle: () => undefined,
    seek: () => undefined,
  };
}

export function __getAudioTrackCalls() {
  return audioTrackCalls;
}

export function __resetAudioTrackStub() {
  audioTrackCalls.length = 0;
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function extractLinks() {
  return [];
}

export function splitTextByLinks(text: string): Array<{ type: 'text'; value: string }> {
  return [{ type: 'text', value: text }];
}

export function Text({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}

export function useLinkPreviewQuery() {
  return { data: null };
}
