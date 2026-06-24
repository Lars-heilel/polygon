import { useCallback, useState } from 'react';
import { queryClient } from '@org/shared';
import { initUpload, uploadToMinio, confirmUpload, updateUserProfile } from '../api/upload-avatar.api';
import { useAvatarStore } from '../model/avatar.store';

export function useAvatarUpload() {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'idle' | 'init' | 'uploading' | 'confirming' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const addFile = useAvatarStore((s) => s.addFile);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setStep('init');
      setProgress(0);

      try {
        const { fileId, presignedUrl } = await initUpload(file.name, file.type, file.size);

        setStep('uploading');
        await uploadToMinio(presignedUrl, file, (pct) => setProgress(pct));

        setStep('confirming');
        const confirmed = await confirmUpload(fileId);

        setStep('saving');
        await updateUserProfile({ avatarUrl: confirmed.url });
        queryClient.invalidateQueries({ queryKey: ['me'] });

        addFile(confirmed);
        setStep('done');
      } catch (e) {
        setStep('error');
        setError(e instanceof Error ? e.message : 'Upload failed');
      }
    },
    [addFile],
  );

  const reset = useCallback(() => {
    setStep('idle');
    setProgress(0);
    setError(null);
  }, []);

  return { upload, reset, progress, step, error, isUploading: step !== 'idle' && step !== 'done' && step !== 'error' };
}
