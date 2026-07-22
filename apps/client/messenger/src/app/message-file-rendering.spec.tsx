import { fireEvent, render, screen } from '@testing-library/react';

import { FileMessage } from '@org/entities-message';

const baseMessage = {
  id: 'message-1',
  clientId: null,
  chatId: 'chat-1',
  senderId: 'user-1',
  kind: 'file',
  type: 'FILE',
  text: null,
  media: null,
  linkPreview: null,
  fileId: 'file-1',
  fileBucket: 'media',
  fileKey: 'chat/file.bin',
  fileName: 'file.bin',
  fileSize: 2048,
  fileMime: 'application/octet-stream',
  fileCategory: 'FILE',
  forwardedFromId: null,
  forwardedFromSenderId: null,
  forwardedFromCreatedAt: null,
  forwardedFromSender: null,
  createdAt: '2026-07-14T10:00:00.000Z',
  updatedAt: '2026-07-14T10:00:00.000Z',
} as const;

describe('message file rendering', () => {
  it.each([
    {
      name: 'image',
      message: {
        ...baseMessage,
        kind: 'image',
        type: 'IMAGE',
        fileId: 'image-file',
        fileName: 'photo.png',
        fileMime: 'image/png',
        fileCategory: 'IMAGE',
        media: {
          fileId: 'image-file',
          contentUrl: '/api/media/files/image-file/content',
          thumbUrl: null,
          fileName: 'photo.png',
          mime: 'image/png',
          size: 2048,
          category: 'IMAGE',
          width: 1200,
          height: 800,
          durationMs: null,
          waveform: null,
        },
      },
      rootTestId: 'image-message',
      mediaTestId: 'image-message-media',
      accessibleName: /photo\.png/i,
      expectedSrc: '/api/media/files/image-file/content',
    },
    {
      name: 'video',
      message: {
        ...baseMessage,
        kind: 'video',
        type: 'VIDEO',
        fileId: 'video-file',
        fileName: 'clip.mp4',
        fileMime: 'video/mp4',
        fileCategory: 'VIDEO',
        media: {
          fileId: 'video-file',
          contentUrl: '/api/media/files/video-file/content',
          thumbUrl: null,
          fileName: 'clip.mp4',
          mime: 'video/mp4',
          size: 2048,
          category: 'VIDEO',
          width: 1280,
          height: 720,
          durationMs: 12000,
          waveform: null,
        },
      },
      rootTestId: 'video-message',
      mediaTestId: 'video-message-media',
      accessibleName: /play video clip\.mp4/i,
      expectedSrc: '/api/media/files/video-file/content',
    },
    {
      name: 'circle',
      message: {
        ...baseMessage,
        kind: 'circle',
        type: 'VIDEO',
        fileId: 'circle-file',
        fileName: 'circle.mp4',
        fileMime: 'video/mp4',
        fileCategory: 'CIRCLE',
        media: {
          fileId: 'circle-file',
          contentUrl: '/api/media/files/circle-file/content',
          thumbUrl: null,
          fileName: 'circle.mp4',
          mime: 'video/mp4',
          size: 2048,
          category: 'CIRCLE',
          width: 640,
          height: 640,
          durationMs: 8000,
          waveform: null,
        },
      },
      rootTestId: 'circle-message',
      mediaTestId: 'circle-message-media',
      accessibleName: /open circle video circle\.mp4/i,
      expectedSrc: '/api/media/files/circle-file/content',
    },
  ])('renders $name messages with a stable media contract', ({
    message,
    rootTestId,
    mediaTestId,
    accessibleName,
    expectedSrc,
  }) => {
    render(<FileMessage message={message} isMine={false} />);

    expect(screen.getByTestId(rootTestId)).toBeTruthy();
    expect(screen.getByRole('button', { name: accessibleName })).toBeTruthy();
    expect(screen.getByTestId(mediaTestId).getAttribute('src')).toBe(expectedSrc);
  });

  it('reserves image and video dimensions from message media metadata', () => {
    render(
      <FileMessage
        message={{
          ...baseMessage,
          kind: 'image',
          type: 'IMAGE',
          fileId: 'image-file',
          fileName: 'photo.png',
          fileMime: 'image/png',
          fileCategory: 'IMAGE',
          media: {
            fileId: 'image-file',
            contentUrl: '/api/media/files/image-file/content',
            thumbUrl: null,
            fileName: 'photo.png',
            mime: 'image/png',
            size: 2048,
            category: 'IMAGE',
            width: 1200,
            height: 800,
            durationMs: null,
            waveform: null,
          },
        }}
        isMine={false}
      />,
    );

    expect(screen.getByTestId('image-message-frame').getAttribute('style')).toContain('aspect-ratio: 1200 / 800');
  });

  it('keeps circle videos on a fixed-size frame', () => {
    render(
      <FileMessage
        message={{
          ...baseMessage,
          kind: 'circle',
          type: 'VIDEO',
          fileId: 'circle-file',
          fileName: 'circle.mp4',
          fileMime: 'video/mp4',
          fileCategory: 'CIRCLE',
        }}
        isMine={false}
      />,
    );

    const frame = screen.getByTestId('circle-message-frame');

    expect(frame.getAttribute('style')).toContain('width: 200px');
    expect(frame.getAttribute('style')).toContain('height: 200px');
  });

  it('renders generic file attachments with a stable download contract', () => {
    render(<FileMessage message={{ ...baseMessage, fileName: 'report.pdf', fileMime: 'application/pdf' }} isMine={false} />);

    const link = screen.getByTestId('file-message');

    expect(link).toBeTruthy();
    expect(screen.getByRole('link', { name: /report\.pdf/i })).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/api/media/files/file-1/content');
    expect(screen.getByText('2.0 KB')).toBeTruthy();
  });

  it('lets circle video messages toggle muted playback through an accessible control', () => {
    render(
      <FileMessage
        message={{
          ...baseMessage,
          type: 'VIDEO',
          fileId: 'circle-file',
          fileName: 'circle.mp4',
          fileMime: 'video/mp4',
          fileCategory: 'CIRCLE',
        }}
        isMine={false}
      />,
    );

    const video = screen.getByTestId('circle-message-media') as HTMLVideoElement;
    const toggle = screen.getByRole('button', { name: /unmute circle video/i });

    expect(video.muted).toBe(true);

    fireEvent.click(toggle);

    expect(video.muted).toBe(false);
    expect(screen.getByRole('button', { name: /mute circle video/i })).toBeTruthy();
  });
});
