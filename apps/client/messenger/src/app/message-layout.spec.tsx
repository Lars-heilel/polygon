import { render, screen } from '@testing-library/react';

import { MessageBubble, MessageContent } from '@org/entities-message';
import type { Message } from '@org/entities-message';
import { ChatMessageRow } from '../../../../../libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list';

const message: Message = {
  id: 'message-1',
  clientId: null,
  chatId: 'chat-1',
  senderId: 'user-1',
  kind: 'text',
  type: 'TEXT',
  text: null,
  media: null,
  linkPreview: null,
  attachments: [],
  forwardContext: null,
  editedAt: null,
  deletedAt: null,
  deletedById: null,
  createdAt: '2026-07-14T10:00:00.000Z',
  updatedAt: '2026-07-14T10:00:00.000Z',
};

describe('message layout', () => {
  it('uses responsive bubble width and aggressive text wrapping to avoid horizontal scroll', () => {
    const longWord = 'x'.repeat(240);

    render(
      <MessageBubble
        message={message}
        isMine={false}
        senderName="User"
      >
        <MessageContent text={longWord} isMine={false} />
      </MessageBubble>,
    );

    const bubble = screen.getByTestId('message-bubble');
    const text = screen.getByTestId('message-text');

    expect(bubble.className).toContain('max-w-[min(82vw,32rem)]');
    expect(bubble.className).toContain('min-w-0');
    expect(text.className).toContain('break-words');
    expect(text.className).toContain('[overflow-wrap:anywhere]');
  });

  it('exposes stable optimistic client ids on message rows', () => {
    render(
      <ChatMessageRow
        msg={{ ...message, clientId: 'client-1' }}
        isMine={false}
        audioQueue={[]}
        audioQueueIndexByMessageId={new Map()}
      />,
    );

    expect(screen.getByTestId('message-row').getAttribute('data-message-client-id')).toBe('client-1');
    expect(screen.getByTestId('message-row').getAttribute('data-message-virtual-key')).toBe('client:client-1');
  });

  it('shows forwarded source author above forwarded content', () => {
    render(
      <MessageBubble
        message={{
          ...message,
          text: 'original forwarded text',
          forwardContext: {
            originalAuthor: {
              id: 'user-source',
              nameSnapshot: 'Alice',
              displayNameSnapshot: 'Alice A.',
            },
            originalMessageCreatedAt: '2026-07-13T09:30:00.000Z',
            originalMessageType: 'TEXT',
            preview: {
              text: 'original forwarded text',
              fileName: null,
            },
          },
        }}
        isMine={false}
        senderName="Forwarder"
      >
        <MessageContent text="original forwarded text" isMine={false} />
      </MessageBubble>,
    );

    expect(screen.getByText('Alice A.')).toBeTruthy();
    expect(screen.getByTestId('forwarded-source').className).toContain('text-primary');
    expect(screen.getByText('13.07.2026 12:30')).toBeTruthy();
    expect(screen.getAllByText('original forwarded text')).toHaveLength(1);
    expect(screen.queryByText('14.07.2026 13:00')).toBeNull();
  });

  it('keeps forwarded media messages close to the reference without duplicating the media filename', () => {
    render(
      <MessageBubble
        message={{
          ...message,
          kind: 'image',
          type: 'IMAGE',
          media: {
            fileId: 'image-1',
            contentUrl: '/image.png',
            thumbUrl: null,
            fileName: 'forwarded-image.png',
            mime: 'image/png',
            size: 1024,
            category: 'IMAGE',
            width: 320,
            height: 320,
            durationMs: null,
            waveform: null,
          },
          forwardContext: {
            originalAuthor: {
              id: 'author-1',
              nameSnapshot: 'Anastasia',
              displayNameSnapshot: 'Anastasia',
            },
            originalMessageCreatedAt: '2026-07-22T10:00:00.000Z',
            originalMessageType: 'IMAGE',
            preview: {
              text: null,
              fileName: 'forwarded-image.png',
            },
          },
        }}
        isMine={false}
        senderName="Forwarder"
      >
        <img src="/image.png" alt="Forwarded" />
        <MessageContent text="За 50к продали ))" isMine={false} />
      </MessageBubble>,
    );

    expect(screen.getByTestId('forwarded-source').textContent).toBe('Anastasia');
    expect(screen.queryByTestId('forwarded-preview')).toBeNull();
    expect(screen.getByText('За 50к продали ))')).toBeTruthy();
  });

  it('uses the original name snapshot when forwarded display name is missing', () => {
    render(
      <MessageBubble
        message={{
          ...message,
          forwardContext: {
            originalAuthor: {
              id: 'user-source',
              nameSnapshot: 'Alice',
              displayNameSnapshot: null,
            },
            originalMessageCreatedAt: '2026-07-13T09:30:00.000Z',
            originalMessageType: 'TEXT',
            preview: {
              text: 'original forwarded text',
              fileName: null,
            },
          },
        }}
        isMine={false}
        senderName="Forwarder"
      >
        <MessageContent text="forwarded text" isMine={false} />
      </MessageBubble>,
    );

    expect(screen.queryByText(/Unknown sender/i)).toBeNull();
    expect(screen.queryByText('Forwarded message')).toBeNull();
    expect(screen.queryByText('Forwarded from user-source')).toBeNull();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('original forwarded text')).toBeTruthy();
  });

  it('renders forwarded header from original author snapshot', () => {
    render(
      <MessageBubble
        message={{
          ...message,
          forwardContext: {
            originalAuthor: {
              id: 'author-1',
              nameSnapshot: 'tamilka',
              displayNameSnapshot: 'Тамилка:3',
            },
            originalMessageCreatedAt: '2026-07-22T10:00:00.000Z',
            originalMessageType: 'VOICE',
            preview: {
              text: null,
              fileName: 'voice.ogg',
            },
          },
        }}
        isMine={false}
        senderName="Forwarder"
      >
        <MessageContent text="" isMine={false} />
      </MessageBubble>,
    );

    expect(screen.getByText('Тамилка:3')).toBeTruthy();
    expect(screen.getByText('voice.ogg')).toBeTruthy();
    expect(screen.queryByText(/Unknown sender/i)).toBeNull();
    expect(screen.getByText('22.07.2026 13:00')).toBeTruthy();
    expect(screen.queryByText('14.07.2026 13:00')).toBeNull();
  });
});
