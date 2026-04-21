import { Skeleton } from '@org/shared';

interface MessageBubbleSkeletonProps {
  isMine?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function MessageBubbleSkeleton({ isMine = false, size = 'md' }: MessageBubbleSkeletonProps) {
  const widths = { sm: 'w-24', md: 'w-40', lg: 'w-56' };
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isMine && <Skeleton className="w-6 h-6 rounded-full shrink-0" />}
      <Skeleton className={`h-10 ${widths[size]} rounded-2xl`} />
    </div>
  );
}
