import { useRef, type ChangeEvent } from 'react';
import { useMediaUpload } from '../hooks/use-media-upload';
import { useMediaStore } from '../model/media.store';

export function MediaUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, reset, progress, step, error, isUploading } = useMediaUpload();
  const files = useMediaStore((s) => s.files);
  const lastFile = files[0];

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await upload(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-4 p-6 border border-zinc-700 rounded-xl bg-zinc-800/50">
      <h2 className="text-lg font-semibold text-zinc-200">Upload Media</h2>

      <div className="flex items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          onChange={handleFile}
          disabled={isUploading}
          className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer disabled:opacity-50"
        />
      </div>

      {step !== 'idle' && (
        <div className="text-sm text-zinc-400 space-y-1">
          {step === 'init' && <span className="text-blue-400">Initializing upload…</span>}
          {step === 'uploading' && (
            <div>
              <span className="text-yellow-400">Uploading to MinIO… {progress}%</span>
              <div className="w-full h-2 bg-zinc-700 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-yellow-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {step === 'confirming' && <span className="text-blue-400">Confirming upload…</span>}
          {step === 'done' && <span className="text-green-400">Upload complete!</span>}
          {step === 'error' && (
            <div className="flex items-center gap-2">
              <span className="text-red-400">Upload failed: {error}</span>
              <button onClick={reset} className="text-xs text-zinc-500 hover:text-zinc-300 underline">
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      {lastFile && step === 'done' && (
        <div className="mt-4 p-3 bg-zinc-700/50 rounded-lg space-y-2">
          <img
            src={lastFile.url}
            alt={lastFile.originalName}
            className="max-w-full h-48 object-contain rounded border border-zinc-600"
          />
          <div className="text-xs text-zinc-400 space-y-0.5">
            <p><span className="text-zinc-500">Name:</span> {lastFile.originalName}</p>
            <p><span className="text-zinc-500">Type:</span> {lastFile.mimeType}</p>
            <p><span className="text-zinc-500">Size:</span> {(lastFile.size / 1024).toFixed(1)} KB</p>
            <p><span className="text-zinc-500">ID:</span> {lastFile.id}</p>
            <p>
              <span className="text-zinc-500">URL:</span>{' '}
              <a href={lastFile.url} target="_blank" rel="noreferrer" className="text-purple-400 hover:underline break-all">
                {lastFile.url}
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
