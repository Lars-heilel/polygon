import { useMediaStore } from '../model/media.store';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function MediaHistory() {
  const files = useMediaStore((s) => s.files);

  if (files.length === 0) {
    return (
      <div className="text-zinc-500 text-center py-8 border border-dashed border-zinc-700 rounded-xl">
        No files yet. Upload one above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-200">History ({files.length})</h2>

      {files.map((file) => (
        <div
          key={file.id}
          className="flex gap-4 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-zinc-600 transition"
        >
          <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-zinc-700">
            {file.mimeType.startsWith('image/') ? (
              <img src={file.url} alt={file.originalName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                {file.mimeType}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-0.5 text-sm">
            <p className="text-zinc-200 font-medium truncate">{file.originalName}</p>
            <p className="text-zinc-500 text-xs">{file.mimeType} &middot; {formatBytes(file.size)}</p>
            <p className="text-zinc-500 text-xs">{formatDate(file.createdAt)}</p>
            <p className="text-zinc-600 text-xs truncate">ID: {file.id}</p>
          </div>

          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 self-center text-purple-400 hover:text-purple-300 text-xs underline"
          >
            Open
          </a>
        </div>
      ))}
    </div>
  );
}
