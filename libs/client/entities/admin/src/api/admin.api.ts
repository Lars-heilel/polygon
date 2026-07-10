import { API_ROUTES } from '@org/common';
import type { AdminSessionsResponse, AdminUserDetail, AdminUserListResponse } from '@org/common';
import { authedFetch } from '@org/shared';

export const adminApi = {
  users(query: string): Promise<AdminUserListResponse> {
    return authedFetch<AdminUserListResponse>(
      `${API_ROUTES.admin.users}?query=${encodeURIComponent(query)}`,
    );
  },

  user(id: string): Promise<AdminUserDetail> {
    return authedFetch<AdminUserDetail>(API_ROUTES.admin.user(id));
  },

  sessions(id: string): Promise<AdminSessionsResponse> {
    return authedFetch<AdminSessionsResponse>(API_ROUTES.admin.sessions(id));
  },
  revokeSession(id: string, sessionId: string): Promise<void> {
    return authedFetch<void>(API_ROUTES.admin.session(id, sessionId), {
      method: 'DELETE',
    });
  },
  revokeAllSessions(id: string): Promise<void> {
    return authedFetch<void>(API_ROUTES.admin.sessions(id), {
      method: 'DELETE',
    });
  },
};
