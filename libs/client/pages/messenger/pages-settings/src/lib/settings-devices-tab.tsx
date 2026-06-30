import { useSessions } from '@org/features-auth';
import { Button, Text } from '@org/shared';

function isExpired(_session: { lastActiveAt: string | null }): boolean {
  if (!_session.lastActiveAt) return false;
  const diff = Date.now() - new Date(_session.lastActiveAt).getTime();
  return diff > 90 * 24 * 60 * 60 * 1000;
}

function DeviceIcon({ isMobile }: { isMobile: boolean }) {
  return (
    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={isMobile
          ? "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          : "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        }
      />
    </svg>
  );
}

export function SettingsDevicesTab() {
  const { sessions, isLoading, revokeSession, revokeAllSessions, isRevokingAll } = useSessions();

  if (isLoading) {
    return <Text>Loading sessions...</Text>;
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => {
        const expired = isExpired(session);
        return (
          <div key={session.id} className="p-4 bg-surface-elevated rounded-lg flex items-center gap-3">
            <DeviceIcon isMobile={session.device?.toLowerCase().includes('mobile') ?? false} />
            <div className="flex-1 min-w-0">
              {session.device && session.device !== 'Desktop' && (
                <Text size="xs" weight="medium" className="truncate">
                  {session.device}
                </Text>
              )}
              <Text size="sm" weight="medium" className="truncate">
                {session.browser || 'Unknown'} on {session.os || 'Unknown'}
              </Text>
              <Text size="xs" color="muted">
                {session.lastActiveAt
                  ? `Last active ${formatRelativeTime(session.lastActiveAt)}`
                  : `Created ${formatRelativeTime(session.createdAt)}`
                }
                {session.ip ? ` · ${session.ip}` : ''}
                {session.country ? ` · ${session.country}` : ''}
              </Text>
            </div>
            {expired ? (
              <span className="text-xs text-text-muted">Expired</span>
            ) : (
              <div className="flex items-center gap-2">
                {session.isCurrent && (
                  <span className="text-xs text-green-500 font-medium">This device</span>
                )}
                <button
                  className="text-xs text-danger hover:underline"
                  onClick={() => revokeSession(session.id)}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        );
      })}
      {sessions.length === 0 && (
        <Text color="muted">No active sessions found.</Text>
      )}
      <Button
        variant="danger"
        className="w-full"
        onClick={revokeAllSessions}
        disabled={isRevokingAll}
      >
        {isRevokingAll ? 'Logging out...' : 'Logout from all devices'}
      </Button>
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}
