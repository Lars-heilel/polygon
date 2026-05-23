import { useState } from 'react';

import { CLIENT_ROUTES } from '@org/common';
import type { registerSchema } from '@org/common';
import { useRegisterMutation } from '@org/entities-user';
import { ApiError } from '@org/shared';
import { useNavigate } from 'react-router';
import type { z } from 'zod';

type RegisterValues = z.infer<typeof registerSchema>;

export function useRegister() {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useRegisterMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  const register = async (values: RegisterValues) => {
    setApiError(null);
    try {
      await mutateAsync(values);
      navigate(`${CLIENT_ROUTES.auth.checkEmail}?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setApiError('This email is already registered.');
      } else {
        setApiError('Registration failed. Please try again.');
      }
    }
  };

  return { register, isPending, apiError };
}
