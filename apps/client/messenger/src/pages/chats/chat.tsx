import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useParams } from 'react-router';
import { Avatar, Button, Spinner, Textarea } from '@org/shared';
import { useGetMessagesQuery, useSendMessageMutation, useMeQuery, type Message } from '@org/entities';
import { useChatSocket } from '../../app/socket/use-chat-socket';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isMine && <Avatar name={message.senderId.slice(0, 6)} size="xs" />}
      <div
        className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
          isMine
            ? 'bg-primary text-white rounded-br-sm'
            : 'bg-surface-elevated text-text rounded-bl-sm'
        }`}
      >
        <p className="break-words">{message.text}</p>
        <p className={`text-[10px] mt-0.5 text-right ${isMine ? 'text-white/60' : 'text-text-muted'}`}>
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();

  const { data: messages = [], isLoading } = useGetMessagesQuery(chatId!);
  const { data: me } = useMeQuery();
  const { mutate: sendMessage, isPending: isSending } = useSendMessageMutation(chatId!);

  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useChatSocket(chatId!);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !chatId || isSending) return;
    setText('');
    sendMessage(trimmed, { onError: () => setText(trimmed) });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!chatId) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <p className="text-sm font-semibold">{chatId.slice(0, 8)}…</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <p className="text-center text-sm text-text-muted py-8">
            No messages yet. Say hi!
          </p>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isMine={msg.senderId === me?.id}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0 flex gap-2 items-end">
        <div className="flex-1">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
            rows={1}
            maxChars={4000}
          />
        </div>
        <Button
          onClick={handleSend}
          disabled={!text.trim() || isSending}
          size="md"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
