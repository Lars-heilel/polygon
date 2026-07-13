import type { LinkPreview } from '@org/common';
import { API_ROUTES } from '@org/common';
import { useQuery } from '@tanstack/react-query';

import { authedFetch } from '../api/authed-fetch';

const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<]+[^<.,:;"')\]\s])/gi;

export function extractLinks(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  return Array.from(new Set(matches.map(normalizeLink).filter(Boolean))) as string[];
}

export function normalizeLink(value: string): string | null {
  const trimmed = value.trim();
  const withProtocol = trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed;

  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function splitTextByLinks(text: string): Array<{ type: 'text' | 'link'; value: string }> {
  const parts: Array<{ type: 'text' | 'link'; value: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const index = match.index ?? 0;
    const rawLink = match[0];

    if (index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    parts.push({ type: 'link', value: normalizeLink(rawLink) ?? rawLink });
    lastIndex = index + rawLink.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

export function useLinkPreviewQuery(url: string | null) {
  return useQuery({
    queryKey: ['link-preview-v2', url],
    enabled: Boolean(url),
    staleTime: 1000 * 60 * 60,
    queryFn: () => {
      if (!url) {
        throw new Error('Link preview URL is required');
      }

      return authedFetch<LinkPreview>(
        `${API_ROUTES.media.linkPreview}?url=${encodeURIComponent(url)}`,
      );
    },
  });
}
