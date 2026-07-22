import { render, screen } from '@testing-library/react';

import { FileMessage } from '@org/entities-message';
import { __getAudioTrackCalls, __resetAudioTrackStub } from '../test-stubs/shared';

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

const baseMessage = {
  id: 'message-1',
  clientId: null,
  chatId: 'chat-1',
  senderId: 'user-1',
  kind: 'audio',
  type: 'FILE',
  text: null,
  media: null,
  linkPreview: null,
  fileId: 'file-1',
  fileBucket: 'media',
  fileKey: 'chat/audio.webm',
  fileName: 'audio.webm',
  fileSize: 1024,
  fileMime: 'audio/webm',
  fileCategory: 'AUDIO',
  forwardedFromId: null,
  createdAt: '2026-07-14T10:00:00.000Z',
  updatedAt: '2026-07-14T10:00:00.000Z',
} as const;

describe('message audio rendering', () => {
  beforeEach(() => {
    __resetAudioTrackStub();
  });

  it('renders uploaded audio files with the same waveform player contract as voice messages', () => {
    const audioQueue = [
      {
        id: 'audio-message-1',
        title: 'audio.webm',
        subtitle: 'Audio file',
        url: '/api/media/files/file-1/content',
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

    expect(screen.getByTestId('audio-waveform-message')).toBeTruthy();
    expect(screen.getByTestId('audio-waveform-frame').className).toContain('h-8');
    expect(screen.getByTestId('audio-waveform')).toBeTruthy();
    expect(screen.getByRole('button', { name: /play audio/i })).toBeTruthy();
    expect(screen.getByLabelText(/seek audio/i)).toBeTruthy();
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
        message={{ ...baseMessage, fileName: 'Vända.flac', fileMime: 'audio/flac' }}
        isMine
      />,
    );

    const card = screen.getByTestId('audio-waveform-message');
    expect(card.className).toContain('bg-surface');
    expect(card.className).toContain('border-border');
    expect(screen.getByText('Vända.flac').className).not.toContain('text-white');
    expect(screen.getByText('Vända.flac').className).toContain('text-text');
    for (const timestamp of screen.getAllByText('0:00')) {
      expect(timestamp.className).toContain('text-text-muted');
    }
  });

  it('keeps voice messages on the waveform player contract', () => {
    render(
      <FileMessage
        message={{ ...baseMessage, fileCategory: 'VOICE', fileName: 'voice.webm' }}
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

  it('uses the same stable audio frame size for audio files and voice messages', () => {
    const { rerender } = render(
      <FileMessage
        message={baseMessage}
        isMine={false}
      />,
    );

    expect(screen.getByTestId('audio-waveform-message').className).toContain('min-h-[88px]');
    expect(screen.getByTestId('audio-waveform-message').className).toContain('w-[min(100%,320px)]');

    rerender(
      <FileMessage
        message={{ ...baseMessage, kind: 'voice', fileCategory: 'VOICE', fileName: 'voice.webm' }}
        isMine={false}
      />,
    );

    expect(screen.getByTestId('voice-waveform-message').className).toContain('min-h-[88px]');
    expect(screen.getByTestId('voice-waveform-message').className).toContain('w-[min(100%,320px)]');
  });

  it('falls back to a generic file attachment when audio metadata is inconsistent', () => {
    render(
      <FileMessage
        message={{ ...baseMessage, fileMime: 'application/octet-stream', fileName: 'audio.bin' }}
        isMine={false}
      />,
    );

    expect(screen.queryByTestId('audio-waveform-message')).toBeNull();
    expect(screen.getByRole('link', { name: /audio.bin/i })).toBeTruthy();
  });
});
