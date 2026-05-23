import { useLogout } from '@org/features-auth';
import { Button, Text } from '@org/shared';

export function SettingsDevicesTab() {
  const { logout } = useLogout();

  return (
    <div className="space-y-4">
      <div className="p-4 bg-surface-elevated rounded-lg flex items-center gap-3">
        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <div className="flex-1">
          <Text size="sm" weight="medium">Chrome on Windows</Text>
          <Text size="xs" color="muted">Last active 2 min ago</Text>
        </div>
        <span className="text-xs text-green-500">Active</span>
      </div>
      <div className="p-4 bg-surface-elevated rounded-lg flex items-center gap-3">
        <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <div className="flex-1">
          <Text size="sm" weight="medium">Mobile App</Text>
          <Text size="xs" color="muted">Last active 2 hours ago</Text>
        </div>
        <button className="text-xs text-danger hover:underline">Logout</button>
      </div>
      <Button variant="danger" className="w-full" onClick={logout}>
        Logout from all devices
      </Button>
    </div>
  );
}
