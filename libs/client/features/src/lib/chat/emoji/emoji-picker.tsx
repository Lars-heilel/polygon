import { useCallback } from 'react';

import Picker from '@emoji-mart/react';
import { useDisclosure } from '@org/shared';
import { createPortal } from 'react-dom';

interface IEmojiPicker {
  onSelect: ({ native }: { native: string }) => void;
}
const fetchEmojiData = async () => {
  const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data');
  return response.json();
};
export function EmojiPicker({ onSelect }: IEmojiPicker) {
  const { isOpen, setIsOpen } = useDisclosure();
  const getEmojiData = useCallback(() => fetchEmojiData(), []);

  return (
    <>
      {isOpen &&
        createPortal(
          <div
            className="fixed"
            style={{
              bottom: '80px',
              right: '20px',
            }}
          >
            <Picker
              onEmojiSelect={onSelect}
              onClickOutside={() => setIsOpen(false)}
              locale="ru"
              data={getEmojiData}
              theme="auto"
              icons="outline"
              skinTonePosition="none"
              previewPosition="none"
            ></Picker>
          </div>,
          document.body,
        )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="p-2 hover:bg-surface-elevated rounded-lg text-text-muted "
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
            d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
    </>
  );
}
