import { useNotificationStore } from '@org/features-notifications';
import { Text, Toggle, useTheme } from '@org/shared';

export function SettingsGeneralTab() {
  const { theme, toggleTheme } = useTheme();
  const { isMuted, setMuted } = useNotificationStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Text
            size="sm"
            weight="medium"
          >
            Notifications
          </Text>
          <Text
            size="xs"
            color="muted"
          >
            Receive push notifications
          </Text>
        </div>
        <Toggle
          aria-label="Toggle notifications"
          checked={!isMuted}
          onChange={(v) => setMuted(!v)}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Text
            size="sm"
            weight="medium"
          >
            Sound
          </Text>
          <Text
            size="xs"
            color="muted"
          >
            Play sound for messages
          </Text>
        </div>
        <Toggle
          aria-label="Toggle message sound"
          checked={!isMuted}
          onChange={(v) => setMuted(!v)}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Text
            size="sm"
            weight="medium"
          >
            Dark Mode
          </Text>
          <Text
            size="xs"
            color="muted"
          >
            Current: {theme}
          </Text>
        </div>
        <Toggle
          aria-label="Toggle dark mode"
          checked={theme === 'dark'}
          onChange={toggleTheme}
        />
      </div>
    </div>
  );
}
