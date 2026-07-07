import { useEffect, useState } from 'react';
import { fetchHistory } from '../api/upload-avatar.api.js';
import { useAvatarStore } from '../model/avatar.store.js';

export function useAvatarHistory(enabled = true) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setFiles = useAvatarStore((s) => s.setFiles);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);
    fetchHistory()
      .then((items: Awaited<ReturnType<typeof fetchHistory>>) => {
        if (!cancelled) {
          setFiles(items);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [enabled, setFiles]);

  return { loading, error };
}
