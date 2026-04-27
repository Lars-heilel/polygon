import { Skeleton } from '@org/shared';

export function ChatHeaderSkeleton() {
  return (
    <header className="px-4 py-3 border-b border-border flex items-center gap-3 sticky shrink-0 h-14">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </header>
  );
}
