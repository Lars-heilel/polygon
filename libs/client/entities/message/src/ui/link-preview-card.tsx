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
  const preview = data ?? {
    url,
    canonicalUrl: null,
    title: null,
    description: null,
    imageUrl: null,
    siteName: null,
    hostname: new URL(url).hostname,
  };

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'mt-2 block overflow-hidden rounded-2xl border transition-colors',
        isMine
          ? 'border-white/20 bg-white/10 hover:bg-white/15'
          : 'border-border bg-surface hover:bg-surface-elevated',
      )}
    >
      {preview.imageUrl && (
        <img
          src={preview.imageUrl}
          alt={preview.title ?? preview.hostname}
          className="h-32 w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      <div className="space-y-1 px-3 py-2.5">
        <Text
          size="xs"
          className={cn(isMine ? 'text-white/70' : 'text-text-muted')}
        >
          {preview.siteName ?? preview.hostname}
        </Text>
        <Text
          size="sm"
          weight="medium"
          className={cn('line-clamp-2', isMine ? 'text-white' : 'text-text')}
        >
          {preview.title ?? preview.hostname}
        </Text>
        {preview.description && (
          <Text
            size="xs"
            className={cn('line-clamp-3', isMine ? 'text-white/70' : 'text-text-muted')}
          >
            {preview.description}
          </Text>
        )}
      </div>
    </a>
  );
});
