import { type ReactNode } from 'react';

interface SidebarLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function SidebarLayout({ sidebar, children }: SidebarLayoutProps) {
  return (
    <div className="h-screen flex bg-surface text-text font-sans overflow-hidden">
      {sidebar}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        {children}
      </main>
    </div>
  );
}
