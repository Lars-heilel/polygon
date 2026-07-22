import { render, screen } from '@testing-library/react';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { ChatMain } from '../../../../../libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatMain';

const listMounts: string[] = [];
const listUnmounts: string[] = [];

jest.mock('@org/features-chat-socket', () => ({
  useChatSocket: jest.fn(),
}));

jest.mock('@org/entities-message', () => ({
  MessageListSkeleton: () => <div data-testid="message-list-skeleton" />,
}));

jest.mock(
  '../../../../../libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');

    return {
      VirtualMessageList: ({ chatId }: { chatId: string }) => {
        const initialChatIdRef = React.useRef(chatId);

        React.useEffect(() => {
          const initialChatId = initialChatIdRef.current;
          listMounts.push(initialChatId);

          return () => {
            listUnmounts.push(initialChatId);
          };
        }, []);

        return (
          <div
            data-testid="virtual-message-list"
            data-chat-id={chatId}
          />
        );
      },
    };
  },
);

describe('chat switch list lifecycle', () => {
  beforeEach(() => {
    listMounts.length = 0;
    listUnmounts.length = 0;
  });

  it('remounts the virtual message list when the active chat changes', () => {
    const { rerender } = render(<ChatMain chatId="chat-1" />);

    expect(screen.getByTestId('virtual-message-list').getAttribute('data-chat-id')).toBe('chat-1');

    rerender(<ChatMain chatId="chat-2" />);

    expect(screen.getByTestId('virtual-message-list').getAttribute('data-chat-id')).toBe('chat-2');
    expect(listMounts).toEqual(['chat-1', 'chat-2']);
    expect(listUnmounts).toEqual(['chat-1']);
  });
});
