import { API_ROUTES, loginSchema, registerSchema } from '@org/common';
import type { User as UserBase } from '@org/common';
import { apiFetch } from '@org/shared';
import { authedFetch } from '@org/shared';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { type z } from 'zod';

import type { Role } from '@org/common';
import type { SessionInfo } from '../model/session.types';

export type User = Omit<UserBase, 'createdAt' | 'updatedAt'> & { role: Role };

export const authApi = {
  login: (body: z.infer<typeof loginSchema>) =>
    apiFetch<void>(API_ROUTES.auth.login, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  register: (body: z.infer<typeof registerSchema>) =>
    apiFetch<void>(API_ROUTES.auth.register, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () => authedFetch<void>(API_ROUTES.auth.logout, { method: 'POST' }),

  me: () => authedFetch<User>(API_ROUTES.users.me),

  forgotPassword: (email: string) =>
    apiFetch<void>(API_ROUTES.auth.forgotPassword, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch<void>(API_ROUTES.auth.resetPassword, {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  resendVerification: (email: string) =>
    apiFetch<void>(API_ROUTES.auth.resendVerification, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  updateProfile: (data: { displayName?: string; bio?: string }) =>
    authedFetch<void>(API_ROUTES.users.me, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getSessions(): Promise<SessionInfo[]> {
    return authedFetch<SessionInfo[]>('auth/sessions');
  },

  revokeSession(sessionId: string): Promise<void> {
    return authedFetch<void>(`auth/sessions/${sessionId}`, { method: 'DELETE' });
  },

  revokeAllSessions(): Promise<void> {
    return authedFetch<void>('auth/sessions', { method: 'DELETE' });
  },
};

export function useMeQuery() {
  return useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    retry: false,
    staleTime: Infinity,
  });
}

export function useMeSuspenseQuery() {
  return useSuspenseQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    staleTime: Infinity,
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

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authApi.resetPassword(token, newPassword),
  });
}

export function useResendVerificationMutation() {
  return useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
  });
}
