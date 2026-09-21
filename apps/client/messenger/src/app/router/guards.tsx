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

type AuthenticatedGuestRedirect = { type: 'internal'; to: string };

export function getAuthenticatedGuestRedirect(): AuthenticatedGuestRedirect {
  return { type: 'internal', to: CLIENT_ROUTES.chats.root };
}

export function GuestGuard() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const isLoading = useSessionStore(selectIsSessionLoading);
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (isAuthenticated && location.pathname !== CLIENT_ROUTES.auth.emailVerified) {
    const redirect = getAuthenticatedGuestRedirect();

    return (
      <Navigate
        to={redirect.to}
        replace
      />
    );
  }

  return <Outlet />;
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
