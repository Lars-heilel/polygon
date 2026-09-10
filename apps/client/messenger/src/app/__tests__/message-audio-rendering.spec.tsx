import { render, screen } from '@testing-library/react';

import { FileMessage } from '@org/entities-message';
import type { Message, MessageMedia } from '@org/entities-message';
import { __getAudioTrackCalls, __resetAudioTrackStub } from '../../test-stubs/shared';

jest.mock('wavesurfer.js', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      destroy: jest.fn(),
      getCurrentTime: jest.fn(() => 0),
      getDuration: jest.fn(() => 0),
      on: jest.fn(),
      playPause: jest.fn(),
      seekTo: jest.fn(),
    })),
  },
}));

const baseMedia: MessageMedia = {
  fileId: 'file-1',
  contentUrl: '/api/chats/chat-1/messages/message-1/attachments/attachment-1/content',
  thumbUrl: null,
  fileName: 'audio.webm',
  mime: 'audio/webm',
  size: 1024,
  category: 'AUDIO',
  width: null,
  height: null,
  durationMs: null,
  waveform: null,
};

const baseMessage: Message = {
  id: 'message-1',
  clientId: null,
  chatId: 'chat-1',
  senderId: 'user-1',
  kind: 'audio',
  type: 'FILE',
  text: null,
  media: baseMedia,
  linkPreview: null,
  attachments: [],
  forwardContext: null,
  editedAt: null,
  deletedAt: null,
  deletedById: null,
  createdAt: '2026-07-14T10:00:00.000Z',
  updatedAt: '2026-07-14T10:00:00.000Z',
};

describe('message audio rendering', () => {
  beforeEach(() => {
    __resetAudioTrackStub();
  });

  it('renders uploaded audio files as compact global-player launchers', () => {
    const audioQueue = [
      {
        id: 'audio-message-1',
        title: 'audio.webm',
        subtitle: 'Audio file',
        url: '/api/chats/chat-1/messages/message-1/attachments/attachment-1/content',
      },
    ];

    render(
      <FileMessage
        message={baseMessage}
        isMine={false}
        audioQueue={audioQueue}
        audioQueueIndex={0}
      />,
    );

    expect(screen.getByTestId('audio-file-message')).toBeTruthy();
    expect(screen.getByTestId('audio-file-message').className).toContain('min-h-[60px]');
    expect(screen.getByTestId('audio-file-message').className).toContain('w-[min(100%,300px)]');
    expect(screen.queryByTestId('audio-waveform')).toBeNull();
    expect(screen.getByRole('button', { name: /play audio/i })).toBeTruthy();
    expect(screen.getByText('audio.webm')).toBeTruthy();
    expect(__getAudioTrackCalls()).toEqual([
      {
        track: audioQueue[0],
        options: { queue: audioQueue, index: 0 },
      },
    ]);
  });

  it('keeps uploaded audio files readable inside own message bubbles', () => {
    render(
      <FileMessage
        message={{ ...baseMessage, media: { ...baseMedia, fileName: 'Vända.flac', mime: 'audio/flac' } }}
        isMine
      />,
    );

    const card = screen.getByTestId('audio-file-message');
    expect(card.className).toContain('bg-surface');
    expect(card.className).toContain('border-border');
    expect(screen.getByText('Vända.flac').className).not.toContain('text-white');
    expect(screen.getByText('Vända.flac').className).toContain('text-text');
    expect(screen.getByText('1.0 KB').className).toContain('text-text-muted');
  });

  it('keeps voice messages on the waveform player contract', () => {
    render(
      <FileMessage
        message={{ ...baseMessage, media: { ...baseMedia, category: 'VOICE', fileName: 'voice.webm' } }}
        isMine={false}
      />,
    );

    expect(screen.getByTestId('voice-waveform-message')).toBeTruthy();
    expect(screen.getByTestId('voice-waveform-message').className).toContain('min-h-[88px]');
    expect(screen.getByTestId('audio-waveform-frame').className).toContain('h-8');
    expect(screen.getByTestId('audio-waveform')).toBeTruthy();
    expect(screen.getByRole('button', { name: /play voice/i })).toBeTruthy();
    expect(screen.getByLabelText(/seek voice/i)).toBeTruthy();
  });

  it('hides the stored file name for voice messages', () => {
    render(
      <FileMessage
        message={{ ...baseMessage, media: { ...baseMedia, category: 'VOICE', fileName: 'voice-secret.webm' } }}
        isMine={false}
      />,
    );

    expect(screen.getByText('Voice message')).toBeTruthy();
    expect(screen.queryByText('voice-secret.webm')).toBeNull();
  });

  it('keeps audio files compact while voice messages keep waveform geometry', () => {
    render(
      <FileMessage
        message={baseMessage}
        isMine={false}
      />,
    );

    expect(screen.getByTestId('audio-file-message').className).toContain('min-h-[60px]');
    expect(screen.getByTestId('audio-file-message').className).toContain('w-[min(100%,300px)]');
    expect(screen.queryByTestId('audio-waveform-message')).toBeNull();
  });

  it('keeps voice messages on a stable waveform frame', () => {
    render(
      <FileMessage
        message={{ ...baseMessage, kind: 'voice', media: { ...baseMedia, category: 'VOICE', fileName: 'voice.webm' } }}
        isMine={false}
      />,
    );

    expect(screen.getByTestId('voice-waveform-message').className).toContain('min-h-[88px]');
    expect(screen.getByTestId('voice-waveform-message').className).toContain('w-[clamp(220px,64vw,360px)]');
  });

  it('falls back to a generic file attachment when audio metadata is inconsistent', () => {
    render(
      <FileMessage
        message={{ ...baseMessage, media: { ...baseMedia, mime: 'application/octet-stream', fileName: 'audio.bin' } }}
        isMine={false}
      />,
    );

    expect(screen.queryByTestId('audio-waveform-message')).toBeNull();
    expect(screen.getByRole('link', { name: /audio.bin/i })).toBeTruthy();
  });
});
