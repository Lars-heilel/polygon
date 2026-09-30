import { Suspense } from 'react';

import { CLIENT_ROUTES } from '@org/common';
import { selectIsAuthenticated, selectIsSessionLoading, useSessionStore } from '@org/entities-user';
import { Spinner } from '@org/shared';
import { Navigate, Outlet, useLocation } from 'react-router';

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <Spinner size="lg" />
    </div>
  );
}

// Token-link pages a signed-in user must still be able to open
// (e.g. clicking a reset link while already authenticated).
const AUTHENTICATED_GUEST_ALLOWLIST = new Set([
  CLIENT_ROUTES.auth.emailVerified,
  CLIENT_ROUTES.auth.resetPassword,
]);

export function getAuthenticatedGuestRedirect(): string {
  return CLIENT_ROUTES.chats.root;
}

export function GuestGuard() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const isLoading = useSessionStore(selectIsSessionLoading);
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (isAuthenticated && !AUTHENTICATED_GUEST_ALLOWLIST.has(location.pathname)) {
    return (
      <Navigate
        to={getAuthenticatedGuestRedirect()}
        replace
      />
    );
  }

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Outlet />
    </Suspense>
  );
}

export function AppGuard() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const isLoading = useSessionStore(selectIsSessionLoading);
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={CLIENT_ROUTES.auth.login}
        state={{ from: location }}
        replace
      />
    );
  }

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Outlet />
    </Suspense>
  );
}
