import { useState } from 'react';

import { useResendVerificationMutation } from '@org/entities';
import { ApiError } from '@org/shared';

type ResendStatus = 'idle' | 'success' | 'error' | 'rate-limited';

export function useResendVerification() {
  const { mutateAsync, isPending } = useResendVerificationMutation();
  const [status, setStatus] = useState<ResendStatus>('idle');

  const resend = async (email: string) => {
    setStatus('idle');
    try {
      await mutateAsync(email);
      setStatus('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setStatus('rate-limited');
      } else {
        setStatus('error');
      }
    }
  };

  return { resend, isPending, status };
}
