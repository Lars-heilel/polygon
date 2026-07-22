import { memo } from 'react';

import { Text, cn, useLinkPreviewQuery } from '@org/shared';

interface LinkPreviewCardProps {
  url: string;
  isMine?: boolean;
}

export const LinkPreviewCard = memo(function LinkPreviewCard({
  url,
  isMine = false,
}: LinkPreviewCardProps) {
  const { data } = useLinkPreviewQuery(url);
  const hostname = new URL(url).hostname;
  const preview = data ?? {
    url,
    canonicalUrl: null,
    title: null,
    description: null,
    imageUrl: null,
    siteName: null,
    hostname,
  };
  const previewHost = preview.siteName ?? hostname;

  return (
    <a
      data-testid="link-preview-card"
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'mt-2 block w-[min(100%,320px)] max-h-[236px] overflow-hidden rounded-lg border transition-colors',
        isMine
          ? 'border-white/20 bg-white/10 hover:bg-white/15'
          : 'border-border bg-surface hover:bg-surface-elevated',
      )}
    >
      {preview.imageUrl && (
        <img
          data-testid="link-preview-image"
          src={preview.imageUrl}
          alt={preview.title ?? previewHost}
          className="h-28 w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      <div
        data-testid="link-preview-body"
        className="flex min-h-[96px] flex-col justify-center gap-1 px-3 py-2.5"
      >
        <Text
          size="xs"
          className={cn('truncate', isMine ? 'text-white/70' : 'text-text-muted')}
        >
          {previewHost}
        </Text>
        <Text
          size="sm"
          weight="medium"
          className={cn('line-clamp-2', isMine ? 'text-white' : 'text-text')}
        >
          {preview.title ?? previewHost}
        </Text>
        {preview.description && (
          <Text
            size="xs"
            className={cn('line-clamp-2', isMine ? 'text-white/70' : 'text-text-muted')}
          >
            {preview.description}
          </Text>
        )}
      </div>
    </a>
  );
});
