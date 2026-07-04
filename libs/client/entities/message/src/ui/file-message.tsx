import { memo, useEffect, useRef, useState } from 'react';

import { cn } from '@org/shared';

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
    case 'pdf':
      return '📄';
    case 'doc':
    case 'docx':
      return '📝';
    case 'xls':
    case 'xlsx':
      return '📊';
    case 'zip':
    case 'rar':
    case '7z':
      return '📦';
    case 'txt':
      return '📃';
    default:
      return '📎';
  }
}

export const FileMessage = memo(function FileMessage({ message, isMine }: FileMessageProps) {
  if (message.fileCategory === 'VOICE') {
    return (
      <VoiceMessage
        message={message}
        isMine={isMine}
      />
    );
  }

  if (message.fileCategory === 'CIRCLE') {
    return (
      <CircleMessage
        message={message}
        isMine={isMine}
      />
    );
  }

  if (message.type === 'IMAGE' && message.fileMime?.startsWith('image/')) {
    return (
      <ImageMessage
        message={message}
        isMine={isMine}
      />
    );
  }

  if (message.fileCategory === 'VIDEO' && message.fileMime?.startsWith('video/')) {
    return (
      <VideoMessage
        message={message}
        isMine={isMine}
      />
    );
  }

  if (message.fileCategory === 'AUDIO' && message.fileMime?.startsWith('audio/')) {
    return (
      <AudioFileMessage
        message={message}
        isMine={isMine}
      />
    );
  }

  return (
    <FileAttachmentMessage
      message={message}
      isMine={isMine}
    />
  );
});

const ImageMessage = memo(function ImageMessage({ message }: FileMessageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imageUrl = `/api/media/files/${message.fileId}/content`;

  // w-full max-w-[280px] позволяет картинке сжиматься под размеры родителя, не выходя за его рамки
  const thumbnailBoxClass =
    'w-full max-w-[280px] h-[160px] rounded-lg overflow-hidden block relative';

  return (
    <>
      <button
        onClick={() => setLightboxOpen(true)}
        className={`${thumbnailBoxClass} hover:opacity-90 transition-opacity focus:outline-none`}
      >
        <img
          src={imageUrl}
          alt={message.fileName ?? 'Image'}
          className="w-full h-full object-cover"
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
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveReady, setWaveReady] = useState(false);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);

  useEffect(() => {
    if (!waveformRef.current) return;
    let mounted = true;

    import('wavesurfer.js').then((WaveSurferMod) => {
      if (!mounted || !waveformRef.current) return;
      const ws = WaveSurferMod.default.create({
        container: waveformRef.current,
        waveColor: isMine ? 'rgba(255,255,255,0.3)' : 'rgba(99,102,241,0.3)',
        progressColor: isMine ? 'rgba(255,255,255,0.7)' : 'rgb(99,102,241)',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 32,
        cursorWidth: 0,
        url: `/api/media/files/${message.fileId}/content`,
        normalize: true,
      });

      ws.on('ready', () => {
        if (!mounted) return;
        setDuration(ws.getDuration());
        setWaveReady(true);
      });

      ws.on('audioprocess', () => {
        if (!mounted) return;
        setCurrentTime(ws.getCurrentTime());
      });

      ws.on('play', () => {
        if (mounted) setPlaying(true);
      });
      ws.on('pause', () => {
        if (mounted) setPlaying(false);
      });
      ws.on('finish', () => {
        if (mounted) {
          setPlaying(false);
          setCurrentTime(0);
        }
      });

      wavesurferRef.current = ws;
    });

    return () => {
      mounted = false;
      wavesurferRef.current?.destroy();
    };
  }, [isMine, message.fileId]);

  const togglePlay = () => {
    wavesurferRef.current?.playPause();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded-lg min-w-50',
        isMine ? 'bg-white/10' : 'bg-surface-elevated',
      )}
    >
      <button
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/20 hover:bg-primary/30 transition-colors shrink-0"
      >
        {playing ? (
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 ml-0.5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div
          ref={waveformRef}
          className={cn('w-full', !waveReady && 'h-8 bg-surface-elevated/40 rounded animate-pulse')}
        />
      </div>
      <span
        className={cn(
          'text-xs tabular-nums shrink-0',
          isMine ? 'text-white/60' : 'text-text-muted',
        )}
      >
        {waveReady ? formatTime(playing ? currentTime : duration) : '...'}
      </span>
    </div>
  );
});

const CircleMessage = memo(function CircleMessage({ message }: FileMessageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const videoUrl = `/api/media/files/${message.fileId}/content`;

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(!muted);
    }
  };

  return (
    <>
      <button
        onClick={() => setLightboxOpen(true)}
        className="relative w-24 h-24 block"
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-cover rounded-full"
          loop
          autoPlay
          muted={muted}
          playsInline
        />
        <span
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 text-white text-xs"
        >
          {muted ? (
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
              />
            </svg>
          ) : (
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
          )}
        </span>
      </button>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <video
            src={videoUrl}
            className="max-w-[90vw] max-h-[90vh] rounded-lg"
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
});

const VideoMessage = memo(function VideoMessage({ message }: FileMessageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const videoUrl = `/api/media/files/${message.fileId}/content`;

  // Применяем ту же отзывчивую логику и для видео
  const thumbnailBoxClass =
    'w-full max-w-[280px] h-[160px] rounded-lg overflow-hidden block relative';

  return (
    <>
      <button
        onClick={() => setLightboxOpen(true)}
        className={`${thumbnailBoxClass} bg-surface-elevated hover:opacity-90 transition-opacity focus:outline-none`}
      >
        <video
          src={videoUrl}
          className="w-full h-full object-cover rounded-lg"
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </button>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <video
            src={videoUrl}
            className="max-w-[90vw] max-h-[90vh] rounded-lg"
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
});

const AudioFileMessage = memo(function AudioFileMessage({ message, isMine }: FileMessageProps) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrl = `/api/media/files/${message.fileId}/content`;

  const togglePlay = () => {
    if (!audioRef.current) return;
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
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded-lg min-w-50',
        isMine ? 'bg-white/10' : 'bg-surface-elevated',
      )}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
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
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 ml-0.5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium truncate', isMine ? 'text-white' : 'text-text')}>
          {message.fileName ?? 'Audio'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isMine ? 'bg-white/60' : 'bg-primary',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span
            className={cn(
              'text-xs tabular-nums shrink-0',
              isMine ? 'text-white/60' : 'text-text-muted',
            )}
          >
            {duration > 0 ? formatTime(playing ? currentTime : duration) : '...'}
          </span>
        </div>
      </div>
    </div>
  );
});

const FileAttachmentMessage = memo(function FileAttachmentMessage({
  message,
  isMine,
}: FileMessageProps) {
  const fileUrl = `/api/media/files/${message.fileId}/content`;

  return (
    <a
      href={fileUrl}
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
      <svg
        className="w-4 h-4 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    </a>
  );
});
