import { MessageBubbleSkeleton } from './message-bubble-skeleton';

export function MessageListSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <MessageBubbleSkeleton
        isMine={false}
        size="md"
      />
      <MessageBubbleSkeleton
        isMine={true}
        size="lg"
      />
      <MessageBubbleSkeleton
        isMine={false}
        size="sm"
      />
      <MessageBubbleSkeleton
        isMine={true}
        size="md"
      />
      <MessageBubbleSkeleton
        isMine={false}
        size="lg"
      />
      <MessageBubbleSkeleton
        isMine={true}
        size="sm"
      />
    </div>
  );
}
