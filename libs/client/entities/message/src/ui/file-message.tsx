import { memo, useEffect, useState } from 'react';

import { cn } from '@org/shared';
import { authedFetch } from '@org/shared';

import type { Message } from '../message.api';
import { ImageLightbox } from './image-lightbox';

interface FileMessageProps {
  message: Message;
  isMine: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return '📄';
    case 'doc':
    case 'docx': return '📝';
    case 'xls':
    case 'xlsx': return '📊';
    case 'zip':
    case 'rar':
    case '7z': return '📦';
    case 'txt': return '📃';
    default: return '📎';
  }
}

export const FileMessage = memo(function FileMessage({ message, isMine }: FileMessageProps) {
  if (message.type === 'IMAGE' && message.fileMime?.startsWith('image/')) {
    return <ImageMessage message={message} isMine={isMine} />;
  }

  return <FileAttachmentMessage message={message} isMine={isMine} />;
});

const ImageMessage = memo(function ImageMessage({ message, isMine }: FileMessageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authedFetch<{ url: string }>(`media/files/${message.fileId}/url`)
      .then((res) => {
        if (!cancelled) {
          setImageUrl(res.url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [message.fileId]);

  if (loading) {
    return (
      <div className="w-48 h-32 bg-surface-elevated rounded-lg animate-pulse" />
    );
  }

  if (!imageUrl) {
    return (
      <span className="text-xs text-text-muted">Failed to load image</span>
    );
  }

  return (
    <>
      <button
        onClick={() => setLightboxOpen(true)}
        className="block max-w-[300px] rounded-lg overflow-hidden hover:opacity-95 transition-opacity"
      >
        <img
          src={imageUrl}
          alt={message.fileName ?? 'Image'}
          className="w-full h-auto max-h-64 object-cover rounded-lg"
          loading="lazy"
        />
      </button>
      {lightboxOpen && (
        <ImageLightbox
          src={imageUrl}
          alt={message.fileName ?? 'Image'}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
});

const FileAttachmentMessage = memo(function FileAttachmentMessage({
  message,
  isMine,
}: FileMessageProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authedFetch<{ url: string }>(`media/files/${message.fileId}/url`)
      .then((res) => {
        if (!cancelled) setFileUrl(res.url);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [message.fileId]);

  return (
    <a
      href={fileUrl ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
        isMine
          ? 'bg-white/10 border-white/20 hover:bg-white/15'
          : 'bg-surface-elevated border-border hover:bg-surface-elevated/80',
      )}
    >
      <span className="text-xl">{getFileIcon(message.fileName ?? '')}</span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', isMine ? 'text-white' : 'text-text')}>
          {message.fileName ?? 'Unknown file'}
        </p>
        <p className={cn('text-xs', isMine ? 'text-white/60' : 'text-text-muted')}>
          {message.fileSize ? formatFileSize(message.fileSize) : ''}
        </p>
      </div>
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </a>
  );
});
