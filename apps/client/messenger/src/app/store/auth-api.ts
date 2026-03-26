import { z } from 'zod';
import { API_ROUTES, loginSchema, registerSchema } from '@org/common';
import { api } from './api';

interface AuthTokens {
  accessToken: string;
}

interface User {
  id:       string;
  email:    string;
  username: string;
}

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<AuthTokens, z.infer<typeof loginSchema>>({
      query: (body) => ({
        url:    API_ROUTES.auth.login,
        method: 'POST',
        body,
      }),
    }),

    register: build.mutation<AuthTokens, z.infer<typeof registerSchema>>({
      query: (body) => ({
        url:    API_ROUTES.auth.register,
        method: 'POST',
        body,
      }),
    }),

    logout: build.mutation<void, void>({
      query: () => ({ url: API_ROUTES.auth.logout, method: 'POST' }),
    }),

    me: build.query<User, void>({
      query: () => API_ROUTES.users.me,
      providesTags: ['User'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useMeQuery,
} = authApi;
