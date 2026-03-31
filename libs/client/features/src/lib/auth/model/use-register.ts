import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CLIENT_ROUTES } from '@org/common';
import { ApiError } from '@org/shared';
import { useRegisterMutation } from '@org/entities';
import type { z } from 'zod';
import type { registerSchema } from '@org/common';

type RegisterValues = z.infer<typeof registerSchema>;

export function useRegister() {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useRegisterMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  const register = async (values: RegisterValues) => {
    setApiError(null);
    try {
      await mutateAsync(values);
      navigate(
        `${CLIENT_ROUTES.auth.checkEmail}?email=${encodeURIComponent(values.email)}`
      );
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
