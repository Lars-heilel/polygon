import { memo } from 'react';

import { extractLinks, splitTextByLinks } from '@org/shared';
import { cn } from '@org/shared';

import { LinkPreviewCard } from './link-preview-card.js';

interface MessageContentProps {
  text: string;
  isMine: boolean;
}

export const MessageContent = memo(function MessageContent({
  text,
  isMine,
}: MessageContentProps) {
  const parts = splitTextByLinks(text);
  const links = extractLinks(text);

  return (
    <div>
      <span
        data-testid="message-text"
        className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
      >
        {parts.map((part, index) =>
          part.type === 'link' ? (
            <a
              key={`${part.value}-${index}`}
              href={part.value}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'underline underline-offset-2 break-all',
                isMine ? 'text-white' : 'text-primary',
              )}
            >
              {part.value}
            </a>
          ) : (
            <span key={`${part.value}-${index}`}>{part.value}</span>
          ),
        )}
      </span>

      {links.map((url) => (
        <LinkPreviewCard key={url} url={url} isMine={isMine} />
      ))}
    </div>
  );
});
