import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import type { AdminSessionsResponse, AdminUserDetail } from '@org/common';
import {
  useAdminRevokeAllSessionsMutation,
  useAdminRevokeSessionMutation,
  useAdminSessionsQuery,
  useAdminUserQuery,
} from '@org/entities-admin';
import { AdminBanDialog } from '@org/features-admin-ban';

import { AdminUserDetailPage } from '../admin-user-detail-page';

jest.mock('@org/entities-admin', () => ({
  useAdminRevokeAllSessionsMutation: jest.fn(),
  useAdminRevokeSessionMutation: jest.fn(),
  useAdminSessionsQuery: jest.fn(),
  useAdminUserQuery: jest.fn(),
}));

jest.mock('@org/features-admin-ban', () => ({
  AdminBanDialog: jest.fn(() => <div data-testid="admin-ban-dialog" />),
}));

const mockedUseAdminUserQuery = jest.mocked(useAdminUserQuery);
const mockedUseAdminSessionsQuery = jest.mocked(useAdminSessionsQuery);
const mockedUseAdminRevokeSessionMutation = jest.mocked(useAdminRevokeSessionMutation);
const mockedUseAdminRevokeAllSessionsMutation = jest.mocked(useAdminRevokeAllSessionsMutation);
const mockedAdminBanDialog = jest.mocked(AdminBanDialog);

const userDetail: AdminUserDetail = {
  id: '8fd79b7d-d3f2-4c66-96c4-61881bc80767',
  email: 'alice@example.com',
  role: 'MODERATOR',
  profile: {
    id: '8fd79b7d-d3f2-4c66-96c4-61881bc80767',
    email: 'alice@example.com',
    name: 'alice',
    displayName: 'Alice A.',
    avatarUrl: null,
    bio: 'Profile bio',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  },
  oauthProviders: ['github', 'google'],
  avatarHistory: [
    {
      id: '2d0a30df-5e50-4df6-9fb7-c2b421ab8d36',
      bucket: 'avatars',
      key: 'avatars/alice.png',
      originalName: 'alice.png',
      mimeType: 'image/png',
      size: 123,
      url: null,
      uploaderId: '8fd79b7d-d3f2-4c66-96c4-61881bc80767',
      status: 'READY',
      chatId: null,
      category: 'AVATAR',
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    },
  ],
  sessionSummary: {
    activeCount: 2,
    totalCount: 3,
  },
  ban: {
    isBanned: true,
    bannedUntil: new Date('2026-02-01T00:00:00.000Z'),
    banReason: 'SPAM',
    bannedAt: new Date('2026-01-04T00:00:00.000Z'),
    bannedBy: 'admin-id',
  },
};

const sessions: AdminSessionsResponse = [
  {
    id: 'session-1',
    device: 'Desktop',
    os: 'Linux',
    browser: 'Firefox',
    ip: '127.0.0.1',
    country: 'UA',
    lastActiveAt: new Date('2026-01-05T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    isCurrent: false,
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/users/8fd79b7d-d3f2-4c66-96c4-61881bc80767']}>
      <Routes>
        <Route path="/users/:id" element={<AdminUserDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminUserDetailPage', () => {
  const revokeSession = jest.fn();
  const revokeAllSessions = jest.fn();

  beforeEach(() => {
    revokeSession.mockResolvedValue(undefined);
    revokeAllSessions.mockResolvedValue(undefined);
    mockedUseAdminUserQuery.mockReturnValue({
      data: userDetail,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAdminUserQuery>);
    mockedUseAdminSessionsQuery.mockReturnValue({
      data: sessions,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAdminSessionsQuery>);
    mockedUseAdminRevokeSessionMutation.mockReturnValue({
      mutateAsync: revokeSession,
      isPending: false,
    } as unknown as ReturnType<typeof useAdminRevokeSessionMutation>);
    mockedUseAdminRevokeAllSessionsMutation.mockReturnValue({
      mutateAsync: revokeAllSessions,
      isPending: false,
    } as unknown as ReturnType<typeof useAdminRevokeAllSessionsMutation>);
  });

  it('renders profile, role, OAuth, avatar history, session summary, ban, and return link', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Alice A.' })).toBeTruthy();
    expect(screen.getByText('alice@example.com')).toBeTruthy();
    expect(screen.getByText('MODERATOR')).toBeTruthy();
    expect(screen.getByText('github')).toBeTruthy();
    expect(screen.getByText('alice.png')).toBeTruthy();
    expect(screen.getByText('2 active / 3 total')).toBeTruthy();
    expect(screen.getByText('Banned: SPAM')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unban user' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to messenger' }).getAttribute('href')).toBe('/');
  });

  it('opens the Admin ban dialog with the current ban state', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Unban user' }));

    expect(mockedAdminBanDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isBanned: true,
        isOpen: true,
        userId: '8fd79b7d-d3f2-4c66-96c4-61881bc80767',
      }),
      undefined,
    );
  });

  it('confirms and revokes one session', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Revoke session session-1' }));

    expect(revokeSession).toHaveBeenCalledWith({
      userId: '8fd79b7d-d3f2-4c66-96c4-61881bc80767',
      sessionId: 'session-1',
    });
  });

  it('confirms and revokes all sessions', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Revoke all sessions' }));

    expect(revokeAllSessions).toHaveBeenCalledWith('8fd79b7d-d3f2-4c66-96c4-61881bc80767');
  });
});
