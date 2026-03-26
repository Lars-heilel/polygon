import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL ?? '/api',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('access_token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['User', 'Chat', 'Message', 'Friend'],
  endpoints: () => ({}),
});
