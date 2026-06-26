import { useCallback, useState } from 'react';
import { initUpload, uploadToMinio, confirmUpload } from '../api/media.api';
import { useMediaStore } from '../model/media.store';

export function useMediaUpload() {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'idle' | 'init' | 'uploading' | 'confirming' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const isUploading = useMediaStore((s) => s.isUploading);
  const setUploading = useMediaStore((s) => s.setUploading);
  const addFile = useMediaStore((s) => s.addFile);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setStep('init');
      setUploading(true);
      setProgress(0);

      try {
        const category = file.type.startsWith('image/') ? 'IMAGE' : file.type.startsWith('audio/') ? 'AUDIO' : file.type.startsWith('video/') ? 'VIDEO' : 'FILE';
        const { fileId, presignedUrl } = await initUpload(file.name, file.type, file.size, category);

        setStep('uploading');
        await uploadToMinio(presignedUrl, file, (pct) => setProgress(pct));

        setStep('confirming');
        const confirmed = await confirmUpload(fileId);

        addFile(confirmed);
        setStep('done');
      } catch (e) {
        setStep('error');
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [setUploading, addFile],
  );

  const reset = useCallback(() => {
    setStep('idle');
    setProgress(0);
    setError(null);
  }, []);

  return { upload, reset, progress, step, error, isUploading };
}
