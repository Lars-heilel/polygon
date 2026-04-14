import { Suspense } from 'react';

import { CLIENT_ROUTES } from '@org/common';
import { selectIsAuthenticated, selectIsSessionLoading, useSessionStore } from '@org/entities';
import { Spinner } from '@org/shared';
import { Navigate, Outlet, useLocation } from 'react-router';

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <Spinner size="lg" />
    </div>
  );
}

export function GuestGuard() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const isLoading = useSessionStore(selectIsSessionLoading);

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={CLIENT_ROUTES.chats.root}
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
