import { useCallback, useEffect, useState } from 'react';

import useEmblaCarousel from 'embla-carousel-react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/utils/cn';
import { IconButton } from '../icon-button';
import { Text } from '../typography';

export interface MediaViewerItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  alt?: string;
  label?: string | null;
}

interface MediaViewerProps {
  isOpen: boolean;
  items: MediaViewerItem[];
  initialIndex?: number;
  onClose: () => void;
}

export function MediaViewer({
  isOpen,
  items,
  initialIndex = 0,
  onClose,
}: MediaViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: items.length > 1,
    startIndex: initialIndex,
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') scrollPrev();
      if (event.key === 'ArrowRight') scrollNext();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, scrollNext, scrollPrev]);

  useEffect(() => {
    if (!emblaApi || !isOpen) return;
    emblaApi.reInit({ loop: items.length > 1, startIndex: initialIndex });
    emblaApi.scrollTo(initialIndex, true);
    onSelect();
    emblaApi.on('select', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, initialIndex, isOpen, items.length, onSelect]);

  if (!isOpen || items.length === 0) {
    return null;
  }

  const activeItem = items[selectedIndex];

  return createPortal(
    <div
      data-testid="media-viewer"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/95 p-3 text-text sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />

      <div
        className="relative z-10 flex h-full w-full max-w-6xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          data-testid="media-viewer-chrome"
          className="mb-3 flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface px-2 py-2 shadow-lg sm:px-3"
        >
          <Text size="sm" className="min-w-0 flex-1 truncate">
            {activeItem?.label ?? activeItem?.alt ?? 'Media'}
          </Text>
          {items.length > 1 && (
            <Text size="xs" color="muted" className="shrink-0 tabular-nums">
              {selectedIndex + 1} / {items.length}
            </Text>
          )}
          <IconButton
            type="button"
            label="Close media viewer"
            size="sm"
            variant="ghost"
            onClick={onClose}
            icon={<span aria-hidden="true" className="text-lg leading-none">x</span>}
          />
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-black">
          {items.length > 1 && (
            <>
              <IconButton
                type="button"
                label="Previous media"
                size="lg"
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  scrollPrev();
                }}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 bg-surface/90 sm:left-4"
                icon={<span aria-hidden="true" className="text-2xl leading-none">‹</span>}
              />
              <IconButton
                type="button"
                label="Next media"
                size="lg"
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  scrollNext();
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 bg-surface/90 sm:right-4"
                icon={<span aria-hidden="true" className="text-2xl leading-none">›</span>}
              />
            </>
          )}

          <div className="h-full overflow-hidden" ref={emblaRef}>
            <div className="flex h-full">
              {items.map((item, index) => (
                <div key={item.id} className="flex min-w-0 shrink-0 basis-full items-center justify-center p-2 sm:p-6">
                  {item.type === 'image' ? (
                    <img
                      src={item.src}
                      alt={item.alt ?? item.label ?? 'Media'}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <video
                      src={item.src}
                      className="max-h-full max-w-full rounded-md object-contain"
                      controls
                      autoPlay={selectedIndex === index}
                      playsInline
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {items.length > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Open media ${index + 1}`}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  index === selectedIndex ? 'bg-primary' : 'bg-surface-elevated',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
