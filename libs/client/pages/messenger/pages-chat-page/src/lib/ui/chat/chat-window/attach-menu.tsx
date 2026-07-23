import { memo, useCallback, useRef, useState } from 'react';

import { cn } from '@org/shared';

interface AttachMenuProps {
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}

const categories = [
  { label: 'Photo', icon: '📷', accept: 'image/*' },
  { label: 'Video', icon: '🎥', accept: 'video/*' },
  { label: 'Audio', icon: '🎵', accept: 'audio/*' },
  { label: 'Document', icon: '📄', accept: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar' },
] as const;

export const AttachMenu = memo(function AttachMenu({ disabled, onFileSelected }: AttachMenuProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentAcceptRef = useRef<string>('');

  const handleClick = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleCategorySelect = useCallback((accept: string) => {
    currentAcceptRef.current = accept;
    setOpen(false);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.accept = accept;
        inputRef.current.click();
      }
    });
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelected(file);
      }
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [onFileSelected],
  );

  return (
    <div className="relative z-[70] shrink-0">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'p-2 hover:bg-surface-elevated rounded-lg text-text-muted transition-colors relative',
          disabled && 'opacity-50 pointer-events-none',
          open && 'bg-surface-elevated text-text',
        )}
      >
        <svg
          className={cn(
            'w-5 h-5 transition-transform duration-200',
            open && 'rotate-45 text-primary',
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
          />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[65]"
            onClick={() => setOpen(false)}
          />

          <div className="absolute bottom-full left-0 mb-2 z-[70] p-1 bg-surface-elevated border border-border rounded-xl shadow-2xl overflow-hidden min-w-44 backdrop-blur-md animate-fade-up">
            {categories.map((cat) => (
              <button
                key={cat.label}
                onClick={() => handleCategorySelect(cat.accept)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary/10 text-sm transition-all group duration-150 text-left"
              >
                <span className="text-base transition-transform group-hover:scale-110 duration-150">
                  {cat.icon}
                </span>
                <span className="text-text group-hover:text-primary font-medium transition-colors">
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
});
