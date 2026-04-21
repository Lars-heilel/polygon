import { useCallback, useState } from 'react';

import { ProfileModal, UserPanel } from '@org/entities';

interface CurrentUserWidgetProps {
  onSettingsClick?: () => void;
}

export function CurrentUserWidget({ onSettingsClick }: CurrentUserWidgetProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleSettingsClick = useCallback(() => {
    setIsProfileOpen(false);
    onSettingsClick?.();
  }, [onSettingsClick]);

  return (
    <>
      <UserPanel onProfileClick={() => setIsProfileOpen(true)} />
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onSettingsClick={handleSettingsClick}
      />
    </>
  );
}
