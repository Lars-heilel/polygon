import { Outlet, useNavigate, useParams } from 'react-router';
import { Avatar, Spinner } from '@org/shared';
import { CLIENT_ROUTES } from '@org/common';
import { useGetChatsQuery, useMeQuery, type Chat } from '@org/entities';

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now  = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth()    === now.getMonth() &&
    date.getDate()     === now.getDate();

  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function ChatItem({ chat, currentUserId, isActive }: {
  chat: Chat;
  currentUserId: string;
  isActive: boolean;
}) {
  const navigate = useNavigate();
  const otherMember = chat.members.find((m) => m.userId !== currentUserId);
  const displayName = otherMember ? otherMember.userId.slice(0, 8) : chat.name ?? 'Chat';
  const lastMessage = chat.messages[0];

  return (
    <button
      onClick={() => navigate(CLIENT_ROUTES.chats.byId(chat.id))}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-surface-elevated text-text'
      }`}
    >
      <Avatar name={displayName} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-1">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {lastMessage && (
            <span className="text-[11px] text-text-muted shrink-0">
              {formatTime(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted truncate">
          {lastMessage?.text ?? 'No messages yet'}
        </p>
      </div>
    </button>
  );
}

export function ChatsLayout() {
  const { chatId } = useParams<{ chatId: string }>();
  const { data: chats, isLoading } = useGetChatsQuery();
  const { data: me } = useMeQuery();

  return (
    <div className="h-screen flex bg-surface text-text font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <p className="text-sm font-semibold">Polygon</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {isLoading && (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}

          {!isLoading && chats?.length === 0 && (
            <p className="text-xs text-text-muted px-2 py-4 text-center">
              No chats yet
            </p>
          )}

          {chats?.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              currentUserId={me?.id ?? ''}
              isActive={chat.id === chatId}
            />
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
