import { Suspense, useEffect } from 'react';

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

type AuthenticatedGuestRedirect =
  | { type: 'internal'; to: string }
  | { type: 'external'; href: string };

export function getAuthenticatedGuestRedirect(
  location: Pick<Location, 'pathname' | 'search'>,
  origin = window.location.origin,
): AuthenticatedGuestRedirect {
  const from = new URLSearchParams(location.search).get('from');

  if (from === `${CLIENT_ROUTES.admin.root}/`) {
    const url = new URL(from, origin);
    if (url.port === '4200') {
      url.port = '4300';
      return { type: 'external', href: url.toString() };
    }

    return { type: 'external', href: from };
  }

  return { type: 'internal', to: CLIENT_ROUTES.chats.root };
}

function ExternalRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.assign(href);
  }, [href]);

  return <FullPageSpinner />;
}

export function GuestGuard() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const isLoading = useSessionStore(selectIsSessionLoading);
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (isAuthenticated && location.pathname !== CLIENT_ROUTES.auth.emailVerified) {
    const redirect = getAuthenticatedGuestRedirect(location);

    if (redirect.type === 'external') {
      return <ExternalRedirect href={redirect.href} />;
    }

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
