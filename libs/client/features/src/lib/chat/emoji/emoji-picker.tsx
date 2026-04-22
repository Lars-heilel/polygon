import { Suspense, lazy, useCallback } from 'react';

import { useDisclosure } from '@org/shared';
import { createPortal } from 'react-dom';

const Picker = lazy(() => import('@emoji-mart/react'));

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
            <Suspense
              fallback={
                <div className="flex items-center justify-center w-[352px] h-[435px]">
                  <svg
                    className="w-12 h-12 text-primary animate-spin"
                    style={{ animationDuration: '1.2s' }}
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
                </div>
              }
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
              />
            </Suspense>
          </div>,
          document.body,
        )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="p-2 hover:bg-surface-elevated rounded-lg text-text-muted hover:text-primary transition-colors hidden lg:block"
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
