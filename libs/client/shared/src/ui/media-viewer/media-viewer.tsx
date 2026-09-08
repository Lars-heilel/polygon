import { useCallback, useEffect, useState } from 'react';

import useEmblaCarousel from 'embla-carousel-react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/utils/cn';
import { IconButton } from '../icon-button';

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
      className="media-viewer"
      onClick={onClose}
    >
      <div
        className="relative z-10 flex h-full w-full flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          data-testid="media-viewer-chrome"
          className="media-viewer__bar"
        >
          <span className="media-viewer__title">
            {activeItem?.label ?? activeItem?.alt ?? 'Media'}
          </span>
          {items.length > 1 && (
            <span className="media-viewer__counter">
              {selectedIndex + 1} / {items.length}
            </span>
          )}
          {activeItem && (
            <a
              href={activeItem.src}
              download
              aria-label="Download media"
              className="media-viewer__action"
              onClick={(event) => event.stopPropagation()}
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          )}
          <button
            type="button"
            aria-label="Close media viewer"
            onClick={onClose}
            className="media-viewer__action"
          >
            <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="media-viewer__stage">
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
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 bg-white/10 text-white hover:bg-white/20 sm:left-4"
                icon={<ChevronLeftIcon />}
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
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 bg-white/10 text-white hover:bg-white/20 sm:right-4"
                icon={<ChevronRightIcon />}
              />
            </>
          )}

          <div className="h-full overflow-hidden" ref={emblaRef}>
            <div className="flex h-full">
              {items.map((item, index) => (
                <div key={item.id} className="flex min-w-0 shrink-0 basis-full items-center justify-center">
                  {item.type === 'image' ? (
                    <img
                      src={item.src}
                      alt={item.alt ?? item.label ?? 'Media'}
                      className="max-h-[82vh] max-w-full object-contain"
                    />
                  ) : (
                    <video
                      src={item.src}
                      className="max-h-[82vh] max-w-full object-contain"
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
          <div className="flex shrink-0 justify-center gap-2 py-3">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Open media ${index + 1}`}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  index === selectedIndex ? 'bg-white' : 'bg-white/30',
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

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
