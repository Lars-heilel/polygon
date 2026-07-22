import { render, screen } from '@testing-library/react';

import { MessageBubble, MessageContent } from '@org/entities-message';
import { ChatMessageRow } from '../../../../../libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list';

const message = {
  id: 'message-1',
  clientId: null,
  chatId: 'chat-1',
  senderId: 'user-1',
  kind: 'text',
  type: 'TEXT',
  text: null,
  media: null,
  linkPreview: null,
  fileId: null,
  fileBucket: null,
  fileKey: null,
  fileName: null,
  fileSize: null,
  fileMime: null,
  fileCategory: null,
  forwardedFromId: null,
  forwardedFromSenderId: null,
  forwardedFromCreatedAt: null,
  forwardedFromType: null,
  forwardedFromText: null,
  forwardedFromFileName: null,
  forwardedFromSender: null,
  createdAt: '2026-07-14T10:00:00.000Z',
  updatedAt: '2026-07-14T10:00:00.000Z',
} as const;

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

  it('shows forwarded source author and original timestamp above forwarded content', () => {
    render(
      <MessageBubble
        message={{
          ...message,
          forwardedFromId: 'forward-source',
          forwardedFromSenderId: 'user-source',
          forwardedFromCreatedAt: '2026-07-13T09:30:00.000Z',
          forwardedFromType: 'TEXT',
          forwardedFromText: 'original forwarded text',
          forwardedFromFileName: null,
          forwardedFromSender: {
            id: 'user-source',
            name: 'Alice',
            displayName: 'Alice A.',
            avatarUrl: null,
            bio: null,
          },
        }}
        isMine={false}
        senderName="Forwarder"
      >
        <MessageContent text="forwarded text" isMine={false} />
      </MessageBubble>,
    );

    expect(screen.getByText('Forwarded from Alice A.')).toBeTruthy();
    expect(screen.getByText('13.07.2026 12:30')).toBeTruthy();
    expect(screen.getByText('original forwarded text')).toBeTruthy();
  });
});
