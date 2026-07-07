import { useRef, type ChangeEvent } from 'react';
import { useAvatarUpload } from '../hooks/use-avatar-upload.js';

interface AvatarUploaderProps {
  onDone?: () => void;
}

export function AvatarUploader({ onDone }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, reset, progress, step, error } = useAvatarUpload();

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
          accept="image/*"
          onChange={handleFile}
          disabled={step !== 'idle' && step !== 'error' && step !== 'done'}
          className="block w-full text-sm text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer disabled:opacity-50"
        />
      </div>

      {step === 'uploading' && (
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}


      {step === 'done' && <p className="text-xs text-green-400">Avatar updated!</p>}

      {step === 'error' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-400">{error}</span>
          <button onClick={reset} className="text-xs text-zinc-500 hover:text-zinc-300 underline">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
