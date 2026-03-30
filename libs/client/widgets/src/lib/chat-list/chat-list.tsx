import { useNavigate, useLocation } from 'react-router';
import { Spinner } from '@org/shared';
import { useGetChatsQuery, useMeQuery } from '@org/entities';
import { ChatItem } from '../chat-item';

export function ChatList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: chats, isLoading } = useGetChatsQuery();
  const { data: me } = useMeQuery();
  const activeChatId = location.pathname.split('/chats/')[1];

  return (
    <nav className="flex-1 overflow-y-auto">
      {isLoading && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {!isLoading && chats?.length === 0 && (
        <p className="text-xs text-text-muted px-4 py-4 text-center">
          No chats yet
        </p>
      )}

      {chats?.map((chat) => {
        const otherMember = chat.members.find((m) => m.userId !== me?.id);
        const displayName = otherMember
          ? otherMember.userId.slice(0, 8)
          : chat.name ?? 'Chat';
        const lastMessage = chat.messages[0];

        return (
          <ChatItem
            key={chat.id}
            id={chat.id}
            name={displayName}
            lastMessage={lastMessage?.text ?? 'No messages yet'}
            time={lastMessage?.createdAt ?? ''}
            unread={0}
            online={false}
            isActive={chat.id === activeChatId}
            onClick={() => navigate(`/chats/${chat.id}`)}
          />
        );
      })}
    </nav>
  );
}
