import { type ReactNode } from 'react';

interface SidebarLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function SidebarLayout({ sidebar, children, sidebarOpen = true, onToggleSidebar }: SidebarLayoutProps) {
  return (
    <div className="h-screen flex bg-surface text-text font-sans overflow-hidden">
      {sidebar}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        {!sidebarOpen && onToggleSidebar && (
          <div className="shrink-0 px-4 py-3 border-b border-border">
            <button
              onClick={onToggleSidebar}
              aria-label="Open sidebar"
              className="p-2 hover:bg-surface-elevated rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
