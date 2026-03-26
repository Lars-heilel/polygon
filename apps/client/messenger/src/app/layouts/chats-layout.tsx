import { Outlet } from 'react-router';

export function ChatsLayout() {
  return (
    <div className="h-screen flex bg-surface text-text font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <p className="text-sm font-semibold">Polygon</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <p className="text-xs text-text-muted px-2 py-1">Chats will appear here</p>
        </nav>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
