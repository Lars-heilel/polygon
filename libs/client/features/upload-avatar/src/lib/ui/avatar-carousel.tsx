import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useEmblaCarousel from 'embla-carousel-react';
import { queryClient } from '@org/shared';
import { deleteFile, updateUserProfile } from '../api/upload-avatar.api';
import { useAvatarStore } from '../model/avatar.store';
import { useAvatarHistory } from '../hooks/use-avatar-history';

interface AvatarCarouselProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AvatarCarousel({ isOpen, onClose }: AvatarCarouselProps) {
  useAvatarHistory();
  const files = useAvatarStore((s) => s.files);
  const removeFile = useAvatarStore((s) => s.removeFile);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, startIndex: 0 });
  const [actionLoading, setActionLoading] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (isOpen && emblaApi) {
      emblaApi.reInit();
    }
  }, [isOpen, emblaApi, files]);

  const currentFile = files[selectedIndex];

  const handleSetActive = async () => {
    if (!currentFile || actionLoading) return;
    setActionLoading(true);
    try {
      await updateUserProfile({ avatarUrl: currentFile.url });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    } catch {
      /* ignore */
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentFile || actionLoading) return;
    setActionLoading(true);
    try {
      await deleteFile(currentFile.id);
      removeFile(currentFile.id);
    } catch {
      /* ignore */
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-200">Avatar History</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {files.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-sm">
            No avatars yet
          </div>
        ) : (
          <>
            <div className="relative px-12 py-6">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex">
                  {files.map((file) => (
                    <div key={file.id} className="shrink-0 basis-full flex justify-center">
                      <img
                        src={file.url}
                        alt={file.originalName}
                        className="w-48 h-48 rounded-full object-cover border-4 border-purple-500 shadow-xl"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={scrollPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-white transition"
                aria-label="Previous"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={scrollNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-white transition"
                aria-label="Next"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex justify-center gap-1.5 pb-2">
              {files.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => emblaApi?.scrollTo(idx)}
                  className={`w-2 h-2 rounded-full transition ${
                    idx === selectedIndex ? 'bg-purple-500' : 'bg-zinc-600'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            <div className="px-4 pb-4 text-center text-xs text-zinc-500">
              {selectedIndex + 1} of {files.length}
            </div>

            <div className="flex gap-3 px-4 pb-4">
              <button
                onClick={handleSetActive}
                disabled={actionLoading}
                className="flex-1 py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition"
              >
                {actionLoading ? 'Saving…' : 'Set as active'}
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="py-2 px-4 rounded-lg bg-zinc-700 hover:bg-red-600 disabled:opacity-50 text-zinc-300 hover:text-white text-sm transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
