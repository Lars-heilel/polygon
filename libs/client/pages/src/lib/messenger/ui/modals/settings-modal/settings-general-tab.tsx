import { useNotificationStore } from '@org/features';
import { Text, Toggle, useTheme } from '@org/shared';

export function SettingsGeneralTab() {
  const { theme, toggleTheme } = useTheme();
  const { isMuted, setMuted } = useNotificationStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Text size="sm" weight="medium">Notifications</Text>
          <Text size="xs" color="muted">Receive push notifications</Text>
        </div>
        <Toggle checked={!isMuted} onChange={(v) => setMuted(!v)} />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Text size="sm" weight="medium">Sound</Text>
          <Text size="xs" color="muted">Play sound for messages</Text>
        </div>
        <Toggle checked={!isMuted} onChange={(v) => setMuted(!v)} />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Text size="sm" weight="medium">Dark Mode</Text>
          <Text size="xs" color="muted">Current: {theme}</Text>
        </div>
        <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
      </div>
      <div>
        <Text size="sm" weight="medium" className="mb-2">Language</Text>
        <select className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm">
          <option>English</option>
          <option>Русский</option>
          <option>Español</option>
        </select>
      </div>
    </div>
  );
}
