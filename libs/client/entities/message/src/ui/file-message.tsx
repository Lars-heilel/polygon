import { memo, useEffect, useRef, useState } from 'react';

import { cn, formatAudioTime, MediaFrame, MediaViewer, type MediaViewerItem, useAudioTrack } from '@org/shared';
import type { AudioTrack } from '@org/shared';
import type WaveSurfer from 'wavesurfer.js';

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

function getMediaDimensions(message: Message): { width: number | null; height: number | null } {
  return {
    width: message.media?.width ?? null,
    height: message.media?.height ?? null,
  };
}

function getMessageMediaUrl(message: Message): string {
  return message.media?.contentUrl ?? '';
}

export const FileMessage = memo(function FileMessage({
  message,
  isMine,
  audioQueue,
  audioQueueIndex,
}: FileMessageProps) {
  const category = message.media?.category ?? null;
  const mime = message.media?.mime ?? null;

  if (!getMessageMediaUrl(message)) {
    return <PendingFileMessage message={message} />;
  }

  if (category === 'VOICE') {
    return (
      <VoiceMessage
        message={message}
        isMine={isMine}
      />
    );
  }

  if (category === 'CIRCLE') {
    return (
      <CircleMessage
        message={message}
        isMine={isMine}
      />
    );
  }

  if (message.type === 'IMAGE' && mime?.startsWith('image/')) {
    return (
      <ImageMessage
        message={message}
        isMine={isMine}
      />
    );
  }

  if (category === 'VIDEO' && mime?.startsWith('video/')) {
    return (
      <VideoMessage
        message={message}
        isMine={isMine}
      />
    );
  }

  if (category === 'AUDIO' && mime?.startsWith('audio/')) {
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

const PendingFileMessage = memo(function PendingFileMessage({ message }: Pick<FileMessageProps, 'message'>) {
  const fileName = message.media?.fileName ?? null;
  const fileSize = message.media?.size ?? null;

  return (
    <div
      data-testid="pending-file-message"
      className={cn(
        'flex max-w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2',
        'border-border bg-surface text-text opacity-80',
      )}
    >
      <span className="text-xl">{getFileIcon(fileName ?? '')}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-text">
          {fileName ?? 'File'}
        </p>
        <p className="text-xs text-text-muted">
          {message.localStatus === 'error' ? 'Failed to send' : fileSize ? formatFileSize(fileSize) : ''}
        </p>
      </div>
    </div>
  );
});

const ImageMessage = memo(function ImageMessage({ message }: FileMessageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imageUrl = getMessageMediaUrl(message);
  const viewerItems: MediaViewerItem[] = [{
    id: message.id,
    type: 'image',
    src: imageUrl,
    alt: message.media?.fileName ?? 'Image',
    label: message.media?.fileName ?? 'Image',
  }];

  const mediaDimensions = getMediaDimensions(message);

  return (
    <>
      <button
        data-testid="image-message"
        aria-label={`Open image ${message.media?.fileName ?? 'Image'}`}
        onClick={() => setLightboxOpen(true)}
        className="block w-full max-w-[280px] transition-opacity hover:opacity-90 focus:outline-none"
      >
        <MediaFrame
          data-testid="image-message-frame"
          width={mediaDimensions.width}
          height={mediaDimensions.height}
          maxWidth={280}
        >
          <img
            data-testid="image-message-media"
            src={imageUrl}
            alt={message.media?.fileName ?? 'Image'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </MediaFrame>
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
      title={message.media?.fileName ?? 'Voice message'}
      url={getMessageMediaUrl(message)}
      isMine={isMine}
    />
  );
});

const CircleMessage = memo(function CircleMessage({ message }: FileMessageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const videoUrl = getMessageMediaUrl(message);
  const viewerItems: MediaViewerItem[] = [{
    id: message.id,
    type: 'video',
    src: videoUrl,
    alt: message.media?.fileName ?? 'Circle video',
    label: message.media?.fileName ?? 'Circle video',
  }];

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(!muted);
    }
  };

  return (
    <>
      <div
        data-testid="circle-message"
        className="relative inline-block"
      >
        <MediaFrame
          data-testid="circle-message-frame"
          fixedSize={200}
          shape="circle"
        >
          <button
            type="button"
            aria-label={`Open circle video ${message.media?.fileName ?? 'Circle video'}`}
            onClick={() => setLightboxOpen(true)}
            className="block h-full w-full focus:outline-none"
          >
            <video
              data-testid="circle-message-media"
              ref={videoRef}
              src={videoUrl}
              className="h-full w-full rounded-full object-cover"
              loop
              autoPlay
              muted={muted}
              playsInline
            />
          </button>
        </MediaFrame>
        <button
          type="button"
          aria-label={muted ? 'Unmute circle video' : 'Mute circle video'}
          onClick={toggleMute}
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
        </button>
      </div>

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
  const videoUrl = getMessageMediaUrl(message);
  const mediaDimensions = getMediaDimensions(message);
  const viewerItems: MediaViewerItem[] = [{
    id: message.id,
    type: 'video',
    src: videoUrl,
    alt: message.media?.fileName ?? 'Video',
    label: message.media?.fileName ?? 'Video',
  }];

  return (
    <>
      <button
        data-testid="video-message"
        aria-label={`Play video ${message.media?.fileName ?? 'Video'}`}
        onClick={() => setLightboxOpen(true)}
        className="block w-full max-w-[280px] transition-opacity hover:opacity-90 focus:outline-none"
      >
        <MediaFrame
          data-testid="video-message-frame"
          width={mediaDimensions.width}
          height={mediaDimensions.height}
          maxWidth={280}
        >
          <video
            data-testid="video-message-media"
            src={videoUrl}
            className="h-full w-full rounded-lg object-cover"
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60">
              <svg
                className="ml-0.5 h-6 w-6 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </MediaFrame>
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

const FileAttachmentMessage = memo(function FileAttachmentMessage({
  message,
}: FileMessageProps) {
  const fileUrl = getMessageMediaUrl(message);
  const fileName = message.media?.fileName ?? null;
  const fileSize = message.media?.size ?? null;

  return (
    <a
      data-testid="file-message"
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex max-w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
        'border-border bg-surface text-text hover:bg-surface-elevated',
      )}
    >
      <span className="text-xl">{getFileIcon(fileName ?? '')}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-text">
          {fileName ?? 'Unknown file'}
        </p>
        <p className="text-xs text-text-muted">
          {fileSize ? formatFileSize(fileSize) : ''}
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

const AudioFileMessage = memo(function AudioFileMessage({
  message,
  audioQueue,
  audioQueueIndex,
}: FileMessageProps) {
  const track = {
    id: `audio-${message.id}`,
    title: message.media?.fileName ?? 'Audio',
    subtitle: 'Audio file',
    url: getMessageMediaUrl(message),
  };
  const player = useAudioTrack(track, {
    queue: audioQueue,
    index: audioQueueIndex,
  });

  return (
    <div
      data-testid="audio-file-message"
      className={cn(
        'flex min-h-[60px] w-[min(100%,300px)] min-w-0 items-center gap-3 rounded-xl border px-3 py-2 shadow-sm',
        'border-border bg-surface text-text',
      )}
    >
      <button
        type="button"
        aria-label={player.isPlaying ? 'Pause audio' : 'Play audio'}
        onClick={player.toggle}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90"
      >
        {player.isPlaying ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">
          {track.title}
        </p>
        <p className="mt-1 truncate text-xs text-text-muted">
          {player.duration > 0
            ? `${formatAudioTime(player.currentTime)} / ${formatAudioTime(player.duration)}`
            : message.media?.size ? formatFileSize(message.media.size) : 'Audio file'}
        </p>
      </div>
    </div>
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
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!waveformRef.current) return;

    let mounted = true;

    import('wavesurfer.js').then((WaveSurferMod) => {
      if (!mounted || !waveformRef.current) return;

      const ws = WaveSurferMod.default.create({
        container: waveformRef.current,
        waveColor: variant === 'audio'
          ? 'rgba(112,59,247,0.48)'
          : isMine ? 'rgba(255,255,255,0.34)' : 'rgba(112,59,247,0.48)',
        progressColor: variant === 'audio'
          ? 'rgb(112,59,247)'
          : isMine ? 'rgba(255,255,255,0.9)' : 'rgb(112,59,247)',
        barWidth: variant === 'voice' ? 2 : 3,
        barGap: 1.5,
        barRadius: 999,
        height: 32,
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

  const isPlaying = playing;
  const displayDuration = duration;
  const displayCurrentTime = currentTime;

  const toggle = () => {
    wavesurferRef.current?.playPause();
  };

  const seek = (nextTime: number) => {
    if (displayDuration <= 0) return;

    if (!wavesurferRef.current) return;
    wavesurferRef.current.seekTo(nextTime / displayDuration);
    setCurrentTime(nextTime);
  };

  return (
    <div
      data-testid={`${variant}-waveform-message`}
      className={cn(
        'flex min-h-[88px] w-[min(100%,320px)] min-w-0 items-center gap-3 rounded-xl border px-3 py-2 shadow-sm',
        variant === 'audio'
          ? 'border-border bg-surface'
          : isMine ? 'border-white/20 bg-white/10' : 'border-border bg-surface',
      )}
    >
      <button
        type="button"
        aria-label={isPlaying ? `Pause ${variant}` : `Play ${variant}`}
        onClick={toggle}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
          variant !== 'audio' && isMine
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-primary/20 text-primary hover:bg-primary/30',
        )}
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
        <p className={cn('truncate text-sm font-medium', variant !== 'audio' && isMine ? 'text-white' : 'text-text')}>
          {title}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className={cn('w-8 text-[11px] font-medium tabular-nums', variant !== 'audio' && isMine ? 'text-white/70' : 'text-text-muted')}>
            {formatAudioTime(displayCurrentTime)}
          </span>
          <div
            data-testid="audio-waveform-frame"
            className="h-8 min-w-0 flex-1"
          >
            <div
              data-testid="audio-waveform"
              ref={waveformRef}
              className={cn(
                'h-full w-full overflow-hidden rounded-lg',
                !waveReady && 'animate-pulse bg-primary/15',
              )}
            />
            <input
              aria-label={`Seek ${variant}`}
              type="range"
              min={0}
              max={displayDuration || 0}
              step={0.1}
              value={Math.min(displayCurrentTime, displayDuration || 0)}
              onChange={(event) => seek(Number(event.target.value))}
              className="sr-only"
            />
          </div>
          <span className={cn('w-8 text-right text-[11px] font-medium tabular-nums', variant !== 'audio' && isMine ? 'text-white/70' : 'text-text-muted')}>
            {formatAudioTime(displayDuration)}
          </span>
        </div>
      </div>
    </div>
  );
});
