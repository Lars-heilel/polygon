import { useState } from 'react';
import { useNavigate } from 'react-router';

import { SettingsDevicesTab } from './settings-devices-tab';
import { SettingsGeneralTab } from './settings-general-tab';
import { SettingsPrivacyTab } from './settings-privacy-tab';
import { useMeQuery } from '@org/entities-user';
import { Heading } from '@org/shared';

type SettingsTab = 'general' | 'privacy' | 'devices';

const TABS: SettingsTab[] = ['general', 'privacy', 'devices'];

export function SettingsPage() {
  const navigate = useNavigate();
  const { data: me } = useMeQuery();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const canAccessAdmin = me?.role === 'CREATOR' || me?.role === 'ADMIN';

  return (
    <div className="flex flex-col h-full bg-surface">
      <header className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate('/chats')}
          aria-label="Back"
          className="p-2 hover:bg-surface-elevated rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Heading level={5} as="h2">Settings</Heading>
        {canAccessAdmin && (
          <a
            aria-label="Admin console"
            className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-surface-elevated"
            href="/admin"
          >
            Admin console
          </a>
        )}
      </header>

      <div className="px-6 py-3 border-b border-border flex gap-4 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-sm font-medium pb-2 border-b-2 capitalize transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'general' && <SettingsGeneralTab />}
        {activeTab === 'privacy' && <SettingsPrivacyTab />}
        {activeTab === 'devices' && <SettingsDevicesTab />}
      </div>
    </div>
  );
}
