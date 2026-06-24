import { MediaUploader } from './ui/media-uploader';
import { MediaHistory } from './ui/media-history';
import { useMediaHistory } from './hooks/use-media-history';

export function MediaTestPage() {
  const { loading, error } = useMediaHistory();

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-200 p-8">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-purple-400">Media Test Page</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Upload files directly to MinIO via presigned URLs
          </p>
        </div>

        {loading && <p className="text-zinc-500 animate-pulse">Loading history...</p>}
        {error && <p className="text-red-400">{error}</p>}

        <MediaUploader />

        <MediaHistory />
      </div>
    </div>
  );
}
