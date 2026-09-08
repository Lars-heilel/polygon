import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useEmblaCarousel from 'embla-carousel-react';
import { EmptyState, queryClient } from '@org/shared';
import { deleteFile, fetchUserAvatarHistory, updateUserProfile } from '../api/upload-avatar.api.js';
import { useAvatarStore } from '../model/avatar.store.js';
import { useAvatarHistory } from '../hooks/use-avatar-history.js';

interface AvatarCarouselProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  readOnly?: boolean;
}

export function AvatarCarousel({ isOpen, onClose, userId, readOnly = false }: AvatarCarouselProps) {
  useAvatarHistory(!readOnly);
  const ownFiles = useAvatarStore((s) => s.files);
  const removeFile = useAvatarStore((s) => s.removeFile);
  const [remoteFiles, setRemoteFiles] = useState<typeof ownFiles>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, startIndex: 0 });
  const [actionLoading, setActionLoading] = useState(false);
  const files = readOnly ? remoteFiles : ownFiles;

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
    if (!readOnly || !userId || !isOpen) return;

    let cancelled = false;
    fetchUserAvatarHistory(userId)
      .then((items: Awaited<ReturnType<typeof fetchUserAvatarHistory>>) => {
        if (!cancelled) {
          setRemoteFiles(items);
          setSelectedIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteFiles([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, readOnly, userId]);

  const currentFile = files[selectedIndex];

  const handleSetActive = async () => {
    if (!currentFile || actionLoading) return;
    setActionLoading(true);
    try {
      await updateUserProfile({ avatarUrl: currentFile.url });
      queryClient.setQueryData(['me'], (old: Record<string, unknown> | undefined) => {
        if (!old) return old;
        return { ...old, avatarUrl: currentFile.url };
      });
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
      queryClient.setQueryData(['me'], (old: Record<string, unknown> | undefined) => {
        if (!old || old.avatarUrl !== currentFile.url) return old;
        const previous = files.find((f) => f.url !== currentFile.url);
        return { ...old, avatarUrl: previous?.url ?? null };
      });
      queryClient.invalidateQueries({ queryKey: ['me'] });
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
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex h-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface text-text shadow-[var(--shadow-popover)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-text">Avatar History</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted transition hover:bg-surface-elevated hover:text-text"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {files.length === 0 ? (
          <EmptyState
            title="No avatars yet"
            description="Upload your first avatar to start the history."
          />
        ) : (
          <>
            <div className="relative shrink-0 px-12 py-6 sm:px-16 sm:py-8">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex">
                  {files.map((file) => (
                    <div key={file.id} className="flex shrink-0 basis-full items-center justify-center">
                      <img
                        src={file.url}
                        alt={file.originalName}
                        className="max-h-[min(44dvh,360px)] max-w-full rounded-2xl object-contain shadow-2xl sm:max-h-[56vh]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={scrollPrev}
                className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 sm:left-4 sm:h-11 sm:w-11"
                aria-label="Previous"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={scrollNext}
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 sm:right-4 sm:h-11 sm:w-11"
                aria-label="Next"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex justify-center gap-1.5 pb-2">
              {files.map((_: (typeof files)[number], idx: number) => (
                <button
                  key={idx}
                  onClick={() => emblaApi?.scrollTo(idx)}
                  className={`w-2 h-2 rounded-full transition ${
                    idx === selectedIndex ? 'bg-primary' : 'bg-surface-muted'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            <div className="px-4 pb-4 text-center text-xs text-text-muted">
              {selectedIndex + 1} of {files.length}
            </div>

            {!readOnly && (
              <div className="flex gap-3 px-5 pb-5">
                <button
                  onClick={handleSetActive}
                  disabled={actionLoading}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
                >
                  {actionLoading ? 'Saving…' : 'Set as active'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  aria-label="Delete avatar"
                  className="rounded-xl bg-surface-elevated px-4 py-2.5 text-sm text-text-muted transition hover:bg-danger hover:text-white disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
