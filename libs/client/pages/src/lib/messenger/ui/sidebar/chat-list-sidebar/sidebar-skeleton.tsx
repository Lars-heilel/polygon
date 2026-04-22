import { ChatItemSkeleton } from '@org/entities';

export function SidebarSkeleton() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="h-14.25 border-b border-border" />
      <div className="h-12 border-b border-border" />
      <div className="flex-1 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <ChatItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
