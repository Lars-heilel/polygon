import { useCallback, useEffect, useState } from 'react';

import useEmblaCarousel from 'embla-carousel-react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/utils/cn';

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

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              scrollPrev();
            }}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition-colors hover:bg-black/70"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              scrollNext();
            }}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition-colors hover:bg-black/70"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <div className="w-full max-w-6xl px-16" onClick={(event) => event.stopPropagation()}>
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {items.map((item) => (
              <div key={item.id} className="flex min-w-0 shrink-0 basis-full items-center justify-center">
                {item.type === 'image' ? (
                  <img
                    src={item.src}
                    alt={item.alt ?? item.label ?? 'Media'}
                    className="max-h-[88vh] max-w-full object-contain"
                  />
                ) : (
                  <video
                    src={item.src}
                    className="max-h-[88vh] max-w-full rounded-xl object-contain"
                    controls
                    autoPlay={selectedIndex === items.indexOf(item)}
                    playsInline
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 text-white/80">
          <div className="min-w-0 flex-1 truncate text-sm">
            {items[selectedIndex]?.label ?? items[selectedIndex]?.alt ?? ''}
          </div>
          {items.length > 1 && (
            <div className="text-xs tabular-nums">
              {selectedIndex + 1} / {items.length}
            </div>
          )}
        </div>

        {items.length > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  index === selectedIndex ? 'bg-white' : 'bg-white/35',
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
