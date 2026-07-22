import { useRef, useState, type ChangeEvent } from 'react';

import { Button } from '@org/shared';

import { useAvatarUpload } from '../hooks/use-avatar-upload.js';

interface AvatarUploaderProps {
  onDone?: () => void;
}

export function AvatarUploader({ onDone }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, reset, progress, step, error } = useAvatarUpload();
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const disabled = step !== 'idle' && step !== 'error' && step !== 'done';

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    await upload(file);
    await new Promise((r) => setTimeout(r, 800));
    onDone?.();
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          aria-label="Choose avatar image"
          accept="image/*"
          onChange={handleFile}
          disabled={disabled}
          className="sr-only"
        />
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </Button>
        <span className="min-w-0 truncate text-sm text-text-muted">
          {selectedFileName ?? 'No file selected'}
        </span>
      </div>

      {step === 'uploading' && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-text-muted">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {step === 'done' && <p className="text-xs text-success">Avatar updated!</p>}

      {step === 'error' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-danger">{error}</span>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-text-muted underline hover:text-text"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
