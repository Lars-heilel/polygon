import { useEffect, useState } from 'react';
import { fetchHistory } from '../api/upload-avatar.api';
import { useAvatarStore } from '../model/avatar.store';

export function useAvatarHistory() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setFiles = useAvatarStore((s) => s.setFiles);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHistory()
      .then((items) => {
        if (!cancelled) {
          setFiles(items);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [setFiles]);

  return { loading, error };
}
