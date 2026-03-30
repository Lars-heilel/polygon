import { http, HttpResponse } from 'msw';

const BASE = '/api';

export const authHandlers = [
  http.post(`${BASE}/auth/login`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.post(`${BASE}/auth/register`, () => {
    return new HttpResponse(null, { status: 201 });
  }),

  http.post(`${BASE}/auth/logout`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.post(`${BASE}/auth/refresh`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.get(`${BASE}/users/me`, () => {
    return HttpResponse.json({
      id: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
      avatarUrl: null,
      bio: null,
    });
  }),

  http.post(`${BASE}/auth/forgot-password`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.post(`${BASE}/auth/reset-password`, () => {
    return new HttpResponse(null, { status: 200 });
  }),
];
