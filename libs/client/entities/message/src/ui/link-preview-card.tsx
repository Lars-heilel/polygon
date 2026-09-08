import { memo } from 'react';

import { Text, cn, useLinkPreviewQuery } from '@org/shared';

interface LinkPreviewCardProps {
  url: string;
  isMine?: boolean;
}

const LinkPreviewSkeleton = memo(function LinkPreviewSkeleton({
  isMine,
}: {
  isMine: boolean;
}) {
  return (
    <div
      data-testid="link-preview-skeleton"
      aria-hidden="true"
      className={cn(
        'mt-2 block w-full max-w-80 overflow-hidden rounded-lg border',
        isMine ? 'border-white/20 bg-black/15' : 'border-border bg-surface-elevated',
      )}
    >
      <div className="aspect-[16/9] w-full animate-shimmer" />
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <div className="h-3 w-24 animate-shimmer rounded" />
        <div className="h-4 w-full animate-shimmer rounded" />
        <div className="h-3 w-4/5 animate-shimmer rounded" />
      </div>
    </div>
  );
});

export const LinkPreviewCard = memo(function LinkPreviewCard({
  url,
  isMine = false,
}: LinkPreviewCardProps) {
  const { data, isLoading } = useLinkPreviewQuery(url);
  if (!data && isLoading) {
    return <LinkPreviewSkeleton isMine={isMine} />;
  }
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
  const title = preview.title?.trim() || null;
  const description = preview.description?.trim() || null;

  return (
    <a
      data-testid="link-preview-card"
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'mt-2 block w-full max-w-80 overflow-hidden rounded-lg border transition-colors',
        isMine
          ? 'border-white/20 bg-black/15 hover:bg-black/25'
          : 'border-border bg-surface-elevated hover:bg-surface-muted',
      )}
    >
      {preview.imageUrl && (
        <img
          data-testid="link-preview-image"
          src={preview.imageUrl}
          alt={title ?? previewHost}
          className="aspect-[16/9] w-full bg-black/20 object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      <div
        data-testid="link-preview-body"
        className="flex flex-col justify-center gap-0.5 px-3 py-2.5"
      >
        <Text
          size="xs"
          className={cn('truncate font-medium tracking-wide uppercase', isMine ? 'text-white/70' : 'text-text-muted')}
        >
          {previewHost}
        </Text>
        {title ? (
          <Text
            size="sm"
            weight="medium"
            className={cn('line-clamp-2', isMine ? 'text-white' : 'text-text')}
          >
            {title}
          </Text>
        ) : null}
        {description ? (
          <Text
            size="xs"
            className={cn('line-clamp-2', isMine ? 'text-white/70' : 'text-text-muted')}
          >
            {description}
          </Text>
        ) : null}
        {!title && !description ? (
          <Text
            size="xs"
            className={cn('truncate', isMine ? 'text-white/70' : 'text-text-muted')}
          >
            {preview.canonicalUrl ?? preview.url}
          </Text>
        ) : null}
      </div>
    </a>
  );
});
