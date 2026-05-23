import { Skeleton } from '@org/shared';

export function ChatItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-3 w-8 shrink-0" />
    </div>
  );
}
