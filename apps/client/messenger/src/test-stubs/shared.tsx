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

export function formatTime(value: string) {
  return value;
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
