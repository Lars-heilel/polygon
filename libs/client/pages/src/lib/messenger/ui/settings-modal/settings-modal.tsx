import { useState } from 'react';

import { useLogout, useTheme } from '@org/features';
import { Button, Modal, Toggle } from '@org/shared';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'privacy' | 'devices';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const { logout } = useLogout();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-lg max-h-[80vh] flex flex-col"
    >
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold">Settings</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-surface-elevated rounded-lg"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="px-6 py-3 border-b border-border flex gap-4 shrink-0">
        {(['general', 'privacy', 'devices'] as SettingsTab[]).map((tab) => (
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
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-text-muted">Receive push notifications</p>
              </div>
              <Toggle
                checked={notifications}
                onChange={setNotifications}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Sound</p>
                <p className="text-xs text-text-muted">Play sound for messages</p>
              </div>
              <Toggle
                checked={sound}
                onChange={setSound}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-text-muted">Current: {theme}</p>
              </div>
              <Toggle
                checked={theme === 'dark'}
                onChange={toggleTheme}
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Language</p>
              <select className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm">
                <option>English</option>
                <option>Русский</option>
                <option>Español</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-2">Who can add me to chats</p>
              <select className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm">
                <option>Everyone</option>
                <option>Contacts only</option>
                <option>Nobody</option>
              </select>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Last seen</p>
              <select className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm">
                <option>Everyone</option>
                <option>Contacts only</option>
                <option>Nobody</option>
              </select>
            </div>
            <div className="pt-4">
              <Button
                variant="danger"
                className="w-full"
              >
                Block User
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="space-y-4">
            <div className="p-4 bg-surface-elevated rounded-lg flex items-center gap-3">
              <svg
                className="w-8 h-8 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium">Chrome on Windows</p>
                <p className="text-xs text-text-muted">Last active 2 min ago</p>
              </div>
              <span className="text-xs text-green-500">Active</span>
            </div>
            <div className="p-4 bg-surface-elevated rounded-lg flex items-center gap-3">
              <svg
                className="w-8 h-8 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium">Mobile App</p>
                <p className="text-xs text-text-muted">Last active 2 hours ago</p>
              </div>
              <button className="text-xs text-danger hover:underline">Logout</button>
            </div>
            <Button
              variant="danger"
              className="w-full"
              onClick={logout}
            >
              Logout from all devices
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
