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
  media: {
    fileId: 'file-1',
    contentUrl: '/api/chats/chat-1/messages/message-1/attachments/attachment-1/content',
    thumbUrl: null,
    fileName: 'file.bin',
    mime: 'application/octet-stream',
    size: 2048,
    category: 'FILE',
    width: null,
    height: null,
    durationMs: null,
    waveform: null,
  },
  linkPreview: null,
  attachments: [],
  forwardContext: null,
  editedAt: null,
  deletedAt: null,
  deletedById: null,
  createdAt: '2026-07-14T10:00:00.000Z',
  updatedAt: '2026-07-14T10:00:00.000Z',
} as const;

describe('message file rendering', () => {
  it('renders pending media without an unstable file URL or empty media src', () => {
    render(
      <FileMessage
        message={{
          ...baseMessage,
          kind: 'image',
          type: 'IMAGE',
          localStatus: 'sending',
          media: {
            ...baseMessage.media,
            fileId: 'pending-file',
            contentUrl: '',
            fileName: 'pending.png',
            mime: 'image/png',
            category: 'IMAGE',
          },
        }}
        isMine={false}
      />,
    );

    expect(screen.getByTestId('pending-file-message')).toBeTruthy();
    expect(screen.queryByTestId('image-message-media')).toBeNull();
    expect(screen.queryByTestId('file-message')).toBeNull();
  });

  it.each([
    {
      name: 'image',
      message: {
        ...baseMessage,
        kind: 'image',
        type: 'IMAGE',
        media: {
          fileId: 'image-file',
          contentUrl: '/api/chats/chat-1/messages/message-1/attachments/image-attachment/content',
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
      expectedSrc: '/api/chats/chat-1/messages/message-1/attachments/image-attachment/content',
    },
    {
      name: 'video',
      message: {
        ...baseMessage,
        kind: 'video',
        type: 'VIDEO',
        media: {
          fileId: 'video-file',
          contentUrl: '/api/chats/chat-1/messages/message-1/attachments/video-attachment/content',
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
      expectedSrc: '/api/chats/chat-1/messages/message-1/attachments/video-attachment/content',
    },
    {
      name: 'circle',
      message: {
        ...baseMessage,
        kind: 'circle',
        type: 'VIDEO',
        media: {
          fileId: 'circle-file',
          contentUrl: '/api/chats/chat-1/messages/message-1/attachments/circle-attachment/content',
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
      expectedSrc: '/api/chats/chat-1/messages/message-1/attachments/circle-attachment/content',
    },
  ])('renders $name messages with a stable media contract', ({
    message,
    rootTestId,
    mediaTestId,
    accessibleName,
    expectedSrc,
  }) => {
    render(<FileMessage message={message as Parameters<typeof FileMessage>[0]['message']} isMine={false} />);

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
          media: {
            fileId: 'image-file',
            contentUrl: '/api/chats/chat-1/messages/message-1/attachments/image-attachment/content',
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
        } as const}
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
          media: {
            fileId: 'circle-file',
            contentUrl: '/api/chats/chat-1/messages/message-1/attachments/circle-attachment/content',
            thumbUrl: null,
            fileName: 'circle.mp4',
            mime: 'video/mp4',
            size: 2048,
            category: 'CIRCLE',
            width: null,
            height: null,
            durationMs: null,
            waveform: null,
          },
        } as const}
        isMine={false}
      />,
    );

    const frame = screen.getByTestId('circle-message-frame');

    expect(frame.getAttribute('style')).toContain('width: 200px');
    expect(frame.getAttribute('style')).toContain('height: 200px');
  });

  it('renders generic file attachments with a stable download contract', () => {
    render(
      <FileMessage
        message={{
          ...baseMessage,
          media: {
            ...baseMessage.media,
            fileName: 'report.pdf',
            mime: 'application/pdf',
          },
        }}
        isMine={false}
      />,
    );

    const link = screen.getByTestId('file-message');

    expect(link).toBeTruthy();
    expect(screen.getByRole('link', { name: /report\.pdf/i })).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/api/chats/chat-1/messages/message-1/attachments/attachment-1/content');
    expect(screen.getByText('2.0 KB')).toBeTruthy();
  });

  it('uses normalized media content urls for rendered file content', () => {
    render(
      <FileMessage
        message={{
          ...baseMessage,
          media: {
            fileId: 'file-1',
            contentUrl: '/api/chats/chat-1/messages/message-1/attachments/attachment-1/content',
            thumbUrl: null,
            fileName: 'report.pdf',
            mime: 'application/pdf',
            size: 2048,
            category: 'FILE',
            width: null,
            height: null,
            durationMs: null,
            waveform: null,
          },
        }}
        isMine={false}
      />,
    );

    expect(screen.getByTestId('file-message').getAttribute('href')).toBe(
      '/api/chats/chat-1/messages/message-1/attachments/attachment-1/content',
    );
  });

  it('lets circle video messages toggle muted playback through an accessible control', () => {
    render(
      <FileMessage
        message={{
          ...baseMessage,
          type: 'VIDEO',
          media: {
            fileId: 'circle-file',
            contentUrl: '/api/chats/chat-1/messages/message-1/attachments/circle-attachment/content',
            thumbUrl: null,
            fileName: 'circle.mp4',
            mime: 'video/mp4',
            size: 2048,
            category: 'CIRCLE',
            width: null,
            height: null,
            durationMs: null,
            waveform: null,
          },
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
