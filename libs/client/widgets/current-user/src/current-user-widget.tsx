import { useCallback, useState } from 'react';

import { ProfileModal, UserPanel, EditProfileModal } from '@org/entities-user';
import { AvatarCarousel } from '@org/features-upload-avatar';

interface CurrentUserWidgetProps {
  onSettingsClick?: () => void;
}

export function CurrentUserWidget({ onSettingsClick }: CurrentUserWidgetProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCarouselOpen, setIsCarouselOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

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
        onAvatarClick={() => setIsCarouselOpen(true)}
        onEditProfileClick={() => setIsEditOpen(true)}
      />
      <AvatarCarousel isOpen={isCarouselOpen} onClose={() => setIsCarouselOpen(false)} />
      <EditProfileModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSaved={() => setIsEditOpen(false)}
      />
    </>
  );
}
