import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { cn, formatAudioTime, MediaViewer, type MediaViewerItem, useAudioTrack } from '@org/shared';
import type { AudioTrack } from '@org/shared';

import type { Message } from '../message.api.js';
import { ImageLightbox } from './image-lightbox.js';

interface FileMessageProps {
  message: Message;
  isMine: boolean;
  audioQueue?: AudioTrack[];
  audioQueueIndex?: number;
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

export const FileMessage = memo(function FileMessage({
  message,
  isMine,
  audioQueue,
  audioQueueIndex,
}: FileMessageProps) {
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
        audioQueue={audioQueue}
        audioQueueIndex={audioQueueIndex}
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
  const viewerItems: MediaViewerItem[] = [{
    id: message.id,
    type: 'image',
    src: imageUrl,
    alt: message.fileName ?? 'Image',
    label: message.fileName ?? 'Image',
  }];

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
          items={viewerItems}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
});

const VoiceMessage = memo(function VoiceMessage({ message, isMine }: FileMessageProps) {
  return (
    <WaveformAudioMessage
      variant="voice"
      title={message.fileName ?? 'Voice message'}
      url={`/api/media/files/${message.fileId}/content`}
      isMine={isMine}
    />
  );
});

const CircleMessage = memo(function CircleMessage({ message }: FileMessageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const videoUrl = `/api/media/files/${message.fileId}/content`;
  const viewerItems: MediaViewerItem[] = [{
    id: message.id,
    type: 'video',
    src: videoUrl,
    alt: message.fileName ?? 'Circle video',
    label: message.fileName ?? 'Circle video',
  }];

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
        <MediaViewer
          isOpen={lightboxOpen}
          items={viewerItems}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
});

const VideoMessage = memo(function VideoMessage({ message }: FileMessageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const videoUrl = `/api/media/files/${message.fileId}/content`;
  const viewerItems: MediaViewerItem[] = [{
    id: message.id,
    type: 'video',
    src: videoUrl,
    alt: message.fileName ?? 'Video',
    label: message.fileName ?? 'Video',
  }];

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
        <MediaViewer
          isOpen={lightboxOpen}
          items={viewerItems}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
});

const AudioFileMessage = memo(function AudioFileMessage({
  message,
  isMine,
  audioQueue,
  audioQueueIndex,
}: FileMessageProps) {
  return (
    <StreamingAudioMessage
      trackId={`audio-${message.id}`}
      title={message.fileName ?? 'Audio'}
      url={`/api/media/files/${message.fileId}/content`}
      isMine={isMine}
      audioQueue={audioQueue}
      audioQueueIndex={audioQueueIndex}
    />
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

interface WaveformAudioMessageProps {
  variant: 'audio' | 'voice';
  title: string;
  url: string;
  isMine: boolean;
}

const WaveformAudioMessage = memo(function WaveformAudioMessage({
  variant,
  title,
  url,
  isMine,
}: WaveformAudioMessageProps) {
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
        waveColor: isMine ? 'rgba(255,255,255,0.28)' : 'rgba(59,130,246,0.22)',
        progressColor: isMine ? 'rgba(255,255,255,0.82)' : 'rgb(59,130,246)',
        barWidth: variant === 'voice' ? 2 : 3,
        barGap: 1.5,
        barRadius: 999,
        height: variant === 'voice' ? 36 : 44,
        cursorWidth: 0,
        url,
        normalize: true,
      });

      ws.on('ready', () => {
        if (!mounted) return;
        setDuration(ws.getDuration());
        setCurrentTime(0);
        setWaveReady(true);
      });
      ws.on('play', () => mounted && setPlaying(true));
      ws.on('pause', () => mounted && setPlaying(false));
      ws.on('finish', () => {
        if (!mounted) return;
        setPlaying(false);
        setCurrentTime(0);
      });
      ws.on('audioprocess', () => {
        if (!mounted) return;
        setCurrentTime(ws.getCurrentTime());
      });
      ws.on('interaction', () => {
        if (!mounted) return;
        setCurrentTime(ws.getCurrentTime());
      });

      wavesurferRef.current = ws;
    });

    return () => {
      mounted = false;
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
    };
  }, [isMine, url, variant]);

  const toggle = () => {
    wavesurferRef.current?.playPause();
  };

  const seek = (nextTime: number) => {
    if (!wavesurferRef.current || duration <= 0) return;
    wavesurferRef.current.seekTo(nextTime / duration);
    setCurrentTime(nextTime);
  };

  return (
    <div
      className={cn(
        'flex min-w-56 items-center gap-3 rounded-xl px-3 py-2',
        isMine ? 'bg-white/10' : 'bg-surface-elevated',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 transition-colors hover:bg-primary/30"
      >
        {playing ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', isMine ? 'text-white' : 'text-text')}>
          {title}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className={cn('w-8 text-[11px] tabular-nums', isMine ? 'text-white/60' : 'text-text-muted')}>
            {formatAudioTime(currentTime)}
          </span>
          <div className="min-w-0 flex-1">
            <div
              ref={waveformRef}
              className={cn(
                'w-full overflow-hidden rounded-lg',
                !waveReady && 'h-10 animate-pulse bg-border/60',
              )}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => seek(Number(event.target.value))}
              className="sr-only"
            />
          </div>
          <span className={cn('w-8 text-right text-[11px] tabular-nums', isMine ? 'text-white/60' : 'text-text-muted')}>
            {formatAudioTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
});

interface StreamingAudioMessageProps {
  trackId: string;
  title: string;
  url: string;
  isMine: boolean;
  audioQueue?: AudioTrack[];
  audioQueueIndex?: number;
}

const StreamingAudioMessage = memo(function StreamingAudioMessage({
  trackId,
  title,
  url,
  isMine,
  audioQueue,
  audioQueueIndex,
}: StreamingAudioMessageProps) {
  const { isPlaying, currentTime, duration, toggle, seek } = useAudioTrack({
    id: trackId,
    title,
    subtitle: 'Audio file',
    url,
  }, {
    queue: audioQueue,
    index: audioQueueIndex,
  });
  const bars = useMemo(() => createWaveformBars(trackId), [trackId]);
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      className={cn(
        'flex min-w-56 items-center gap-3 rounded-xl px-3 py-2',
        isMine ? 'bg-white/10' : 'bg-surface-elevated',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 transition-colors hover:bg-primary/30"
      >
        {isPlaying ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', isMine ? 'text-white' : 'text-text')}>
          {title}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className={cn('w-8 text-[11px] tabular-nums', isMine ? 'text-white/60' : 'text-text-muted')}>
            {formatAudioTime(currentTime)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex h-10 items-end gap-1 overflow-hidden rounded-lg">
              {bars.map((bar, index) => {
                const barProgress = bars.length <= 1 ? 1 : index / (bars.length - 1);
                const isActive = barProgress <= progress;

                return (
                  <button
                    key={`${trackId}-${index}`}
                    type="button"
                    onClick={() => seek(duration * barProgress)}
                    className={cn(
                      'w-[4px] shrink-0 rounded-full transition-colors',
                      isActive
                        ? (isMine ? 'bg-white' : 'bg-primary')
                        : (isMine ? 'bg-white/25' : 'bg-border'),
                    )}
                    style={{ height: `${bar}px` }}
                  />
                );
              })}
            </div>
          </div>
          <span className={cn('w-8 text-right text-[11px] tabular-nums', isMine ? 'text-white/60' : 'text-text-muted')}>
            {formatAudioTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
});

function createWaveformBars(seed: string): number[] {
  const bars: number[] = [];
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }

  for (let index = 0; index < 36; index += 1) {
    hash = (hash * 1664525 + 1013904223) | 0;
    const normalized = Math.abs(hash % 100) / 100;
    bars.push(12 + Math.round(normalized * 28));
  }

  return bars;
}
