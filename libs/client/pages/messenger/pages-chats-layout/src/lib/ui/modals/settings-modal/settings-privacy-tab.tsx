import { Button, showComingSoonToast, Text } from '@org/shared';

export function SettingsPrivacyTab() {
  return (
    <div className="space-y-6">
      <div>
        <Text
          size="sm"
          weight="medium"
          className="mb-2"
        >
          Who can add me to chats
        </Text>
        <select onChange={showComingSoonToast} className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm">
          <option>Everyone</option>
          <option>Contacts only</option>
          <option>Nobody</option>
        </select>
      </div>
      <div>
        <Text
          size="sm"
          weight="medium"
          className="mb-2"
        >
          Last seen
        </Text>
        <select onChange={showComingSoonToast} className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm">
          <option>Everyone</option>
          <option>Contacts only</option>
          <option>Nobody</option>
        </select>
      </div>
      <div className="pt-4">
        <Button
          onClick={showComingSoonToast}
          variant="danger"
          className="w-full"
        >
          Block User
        </Button>
      </div>
    </div>
  );
}
