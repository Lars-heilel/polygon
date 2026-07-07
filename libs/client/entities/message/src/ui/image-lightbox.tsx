import { memo } from 'react';

import { MediaViewer, type MediaViewerItem } from '@org/shared';

interface ImageLightboxProps {
  items: MediaViewerItem[];
  initialIndex?: number;
  onClose: () => void;
}

export const ImageLightbox = memo(function ImageLightbox({
  items,
  initialIndex = 0,
  onClose,
}: ImageLightboxProps) {
  return (
    <MediaViewer
      isOpen
      items={items}
      initialIndex={initialIndex}
      onClose={onClose}
    />
  );
});
