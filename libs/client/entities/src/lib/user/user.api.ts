import { useQuery, useMutation } from '@tanstack/react-query';
import { type z } from 'zod';
import {
  API_ROUTES,
  loginSchema,
  registerSchema,
  tokenPairSchema,
} from '@org/common';
import type { User as UserBase } from '@org/common';
import { apiFetch } from '@org/shared';
import { authedFetch } from '../api/authed-fetch';

export type User = Omit<UserBase, 'createdAt' | 'updatedAt'>;
export type TokenPair = z.infer<typeof tokenPairSchema>;

export const authApi = {
  login: (body: z.infer<typeof loginSchema>) =>
    apiFetch<TokenPair>(API_ROUTES.auth.login, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  register: (body: z.infer<typeof registerSchema>) =>
    apiFetch<TokenPair>(API_ROUTES.auth.register, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () => authedFetch<void>(API_ROUTES.auth.logout, { method: 'POST' }),

  me: () => authedFetch<User>(API_ROUTES.users.me),
};

export function useMeQuery() {
  return useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
  });
}

export function useLoginMutation() {
  return useMutation({ mutationFn: authApi.login });
}

export function useRegisterMutation() {
  return useMutation({ mutationFn: authApi.register });
}

export function useLogoutMutation() {
  return useMutation({ mutationFn: authApi.logout });
}
