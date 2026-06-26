import { type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { Avatar, Text } from '@org/shared';
import { useMeQuery } from '@org/entities-user';

interface TabConfig {
  path: string;
  label: string;
  icon: ReactNode;
}

interface MobileLayoutProps {
  children: ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me } = useMeQuery();

  const tabs: TabConfig[] = [
    {
      path: '/chats',
      label: 'Chats',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      path: '/chats/settings',
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      path: '/chats/profile',
      label: '',
      icon: (
        <Avatar
          src={me?.avatarUrl ?? undefined}
          name={me?.displayName ?? me?.name ?? me?.email.slice(0, 8) ?? '?'}
          size="sm"
        />
      ),
    },
  ];

  const isActive = (path: string) => {
    if (path === '/chats') {
      return location.pathname === '/chats';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="h-dvh flex flex-col bg-surface">
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      <nav className="shrink-0 border-t border-border bg-surface px-4 pb-safe">
        <div className="flex items-center justify-around py-2">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-0 ${
                  active ? 'text-primary' : 'text-text-muted'
                }`}
              >
                {tab.icon}
                {tab.label && (
                  <Text size="xs" className={active ? 'text-primary' : 'text-text-muted'}>
                    {tab.label}
                  </Text>
                )}
                {!tab.label && me && (
                  <Text size="xs" className="truncate max-w-16 text-center">
                    {me.displayName ?? me.name ?? me.email.slice(0, 6)}
                  </Text>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
