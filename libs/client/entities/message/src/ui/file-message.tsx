import { memo, useEffect, useRef, useState } from 'react';

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
  if (message.fileCategory === 'VOICE') {
    return <VoiceMessage message={message} isMine={isMine} />;
  }

  if (message.fileCategory === 'CIRCLE') {
    return <CircleMessage message={message} isMine={isMine} />;
  }

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

const VoiceMessage = memo(function VoiceMessage({ message, isMine }: FileMessageProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    authedFetch<{ url: string }>(`media/files/${message.fileId}/url`)
      .then((res) => { setAudioUrl(res.url); })
      .catch(() => {});
  }, [message.fileId]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const onEnded = () => {
    setPlaying(false);
    setCurrentTime(0);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('flex items-center gap-2 px-2 py-1 rounded-lg min-w-[200px]', isMine ? 'bg-white/10' : 'bg-surface-elevated')}>
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        preload="metadata"
      />
      <button
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/20 hover:bg-primary/30 transition-colors shrink-0"
      >
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', isMine ? 'bg-white/60' : 'bg-primary')}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className={cn('text-xs tabular-nums shrink-0', isMine ? 'text-white/60' : 'text-text-muted')}>
        {duration > 0 ? formatTime(playing ? currentTime : duration) : '...'}
      </span>
    </div>
  );
});

const CircleMessage = memo(function CircleMessage({ message, isMine }: FileMessageProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    authedFetch<{ url: string }>(`media/files/${message.fileId}/url`)
      .then((res) => { setVideoUrl(res.url); })
      .catch(() => {});
  }, [message.fileId]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(!muted);
    }
  };

  return (
    <div className="relative w-24 h-24">
      {videoUrl ? (
        <>
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover rounded-full"
            loop
            autoPlay
            muted={muted}
            playsInline
          />
          <button
            onClick={toggleMute}
            className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 text-white text-xs"
          >
            {muted ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        </>
      ) : (
        <div className="w-full h-full rounded-full bg-surface-elevated animate-pulse" />
      )}
    </div>
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
