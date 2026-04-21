import { useState } from 'react';

import { Modal } from '@org/shared';

import { SettingsDevicesTab } from './settings-devices-tab';
import { SettingsGeneralTab } from './settings-general-tab';
import { SettingsPrivacyTab } from './settings-privacy-tab';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'privacy' | 'devices';

const TABS: SettingsTab[] = ['general', 'privacy', 'devices'];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg max-h-[80vh] flex flex-col">
      <Modal.Header title="Settings" />

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
    </Modal>
  );
}
