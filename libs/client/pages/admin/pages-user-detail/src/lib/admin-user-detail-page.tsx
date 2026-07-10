import { useState } from 'react';
import { Link, useParams } from 'react-router';

import {
  useAdminRevokeAllSessionsMutation,
  useAdminRevokeSessionMutation,
  useAdminSessionsQuery,
  useAdminUserQuery,
} from '@org/entities-admin';
import { AdminBanDialog } from '@org/features-admin-ban';
import type { AdminSessionsResponse, AdminUserDetail } from '@org/common';
import { Button, Heading, Spinner, Text } from '@org/shared';

export function AdminUserDetailPage() {
  const { id } = useParams();
  const userId = id ?? '';
  const userQuery = useAdminUserQuery(userId);
  const sessionsQuery = useAdminSessionsQuery(userId);
  const revokeSession = useAdminRevokeSessionMutation();
  const revokeAllSessions = useAdminRevokeAllSessionsMutation();
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);

  if (!userId) {
    return <Text className="text-danger">Missing user id</Text>;
  }

  if (userQuery.isLoading) {
    return <Spinner label="Loading user" />;
  }

  if (userQuery.isError || !userQuery.data) {
    return <Text className="text-danger">Could not load user</Text>;
  }

  const user = userQuery.data;
  const displayName = user.profile.displayName ?? user.profile.name;

  const onRevokeSession = async (sessionId: string) => {
    if (!window.confirm(`Revoke session ${sessionId}?`)) {
      return;
    }

    await revokeSession.mutateAsync({ userId, sessionId });
  };

  const onRevokeAllSessions = async () => {
    if (!window.confirm('Revoke all sessions for this user?')) {
      return;
    }

    await revokeAllSessions.mutateAsync(userId);
  };

  return (
    <main className="min-h-screen bg-surface p-6 text-text">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link className="text-sm text-primary" to="/users">
            Back to users
          </Link>
          <Heading level={2} as="h1">
            {displayName}
          </Heading>
          <Text className="text-text-muted">{user.email}</Text>
          <a className="text-sm text-primary" href="/">
            Back to messenger
          </a>
        </header>

        <section className="rounded-lg border border-border bg-surface-elevated p-4">
          <Heading level={5} as="h2">
            Profile
          </Heading>
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="text-text-muted">Username</dt>
              <dd>{user.profile.name}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Role</dt>
              <dd>{user.role}</dd>
            </div>
            {user.profile.bio && (
              <div>
                <dt className="text-text-muted">Bio</dt>
                <dd>{user.profile.bio}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-surface-elevated p-4">
          <Heading level={5} as="h2">
            OAuth providers
          </Heading>
          <div className="mt-3 flex flex-wrap gap-2">
            {user.oauthProviders.length > 0
              ? user.oauthProviders.map((provider: string) => (
                  <span key={provider} className="rounded border border-border px-2 py-1 text-sm">
                    {provider}
                  </span>
                ))
              : 'No OAuth providers'}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface-elevated p-4">
          <Heading level={5} as="h2">
            Avatar history
          </Heading>
          <ul className="mt-3 list-inside list-disc text-sm">
            {user.avatarHistory.length > 0
              ? user.avatarHistory.map((avatar: AdminUserDetail['avatarHistory'][number]) => (
                  <li key={avatar.id}>{avatar.originalName}</li>
                ))
              : 'No avatar history'}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-surface-elevated p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Heading level={5} as="h2">
              Sessions
            </Heading>
            <Button
              loading={revokeAllSessions.isPending}
              onClick={onRevokeAllSessions}
              type="button"
              variant="danger"
            >
              Revoke all sessions
            </Button>
          </div>
          <Text className="mt-2 text-text-muted">
            {user.sessionSummary.activeCount} active / {user.sessionSummary.totalCount} total
          </Text>
          {sessionsQuery.isLoading && <Spinner label="Loading sessions" />}
          {sessionsQuery.data && (
            <ul className="mt-3 divide-y divide-border">
              {sessionsQuery.data.map((session: AdminSessionsResponse[number]) => (
                <li key={session.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm">
                    {session.device ?? 'Unknown device'} · {session.browser ?? 'Unknown browser'}
                  </span>
                  <Button
                    aria-label={`Revoke session ${session.id}`}
                    loading={revokeSession.isPending}
                    onClick={() => void onRevokeSession(session.id)}
                    type="button"
                    variant="secondary"
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface-elevated p-4">
          <Heading level={5} as="h2">
            Ban
          </Heading>
          <Text className={user.ban.isBanned ? 'text-danger' : 'text-text-muted'}>
            {user.ban.isBanned ? `Banned: ${user.ban.banReason ?? 'Unknown reason'}` : 'Not banned'}
          </Text>
          <Button
            className="mt-3"
            onClick={() => setIsBanDialogOpen(true)}
            type="button"
            variant={user.ban.isBanned ? 'secondary' : 'danger'}
          >
            {user.ban.isBanned ? 'Unban user' : 'Ban user'}
          </Button>
        </section>
      </div>
      <AdminBanDialog
        isBanned={user.ban.isBanned}
        isOpen={isBanDialogOpen}
        onClose={() => setIsBanDialogOpen(false)}
        userId={userId}
      />
    </main>
  );
}
