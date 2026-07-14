import { render, screen } from '@testing-library/react';

import { MessageBubble, MessageContent } from '@org/entities-message';

const message = {
  id: 'message-1',
  chatId: 'chat-1',
  senderId: 'user-1',
  type: 'TEXT',
  text: null,
  fileId: null,
  fileBucket: null,
  fileKey: null,
  fileName: null,
  fileSize: null,
  fileMime: null,
  fileCategory: null,
  forwardedFromId: null,
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
});
