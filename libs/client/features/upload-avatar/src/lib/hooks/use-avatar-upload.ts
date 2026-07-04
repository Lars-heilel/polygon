import { useCallback, useState } from 'react';
import { queryClient } from '@org/shared';
import { uploadAvatar } from '../api/upload-avatar.api';
import { useAvatarStore } from '../model/avatar.store';

export function useAvatarUpload() {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const addFile = useAvatarStore((s) => s.addFile);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setStep('uploading');
      setProgress(0);

      try {
        setProgress(50);
        const result = await uploadAvatar(file);
        setProgress(100);

        queryClient.setQueryData(['me'], (old: Record<string, unknown> | undefined) => {
          if (!old) return old;
          return { ...old, avatarUrl: result.url };
        });
        queryClient.invalidateQueries({ queryKey: ['me'] });

        addFile({
          id: result.id,
          url: result.url,
          bucket: result.bucket,
          key: result.key,
          originalName: result.originalName,
          mimeType: result.mimeType,
          size: result.size,
          category: 'AVATAR',
          createdAt: result.createdAt,
        });
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

  return { upload, reset, progress, step, error, isUploading: step === 'uploading' };
}
