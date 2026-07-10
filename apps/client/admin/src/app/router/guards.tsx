import { Suspense, useEffect } from 'react';

import type { Role } from '@org/common';
import {
  selectIsAuthenticated,
  selectIsSessionLoading,
  useMeQuery,
  useSessionStore,
} from '@org/entities-user';
import { Spinner } from '@org/shared';
import { Navigate, Outlet } from 'react-router';

const ADMIN_LOGIN_URL = '/auth/login?from=/admin';
const ADMIN_ALLOWED_ROLES = new Set<Role>(['CREATOR', 'ADMIN']);

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <Spinner size="lg" />
    </div>
  );
}

export function redirectToAdminLogin(
  location: Pick<Location, 'assign'> = window.location,
): void {
  location.assign(ADMIN_LOGIN_URL);
}

function ExternalLoginRedirect() {
  useEffect(() => {
    redirectToAdminLogin();
  }, []);

  return <FullPageSpinner />;
}

function canAccessAdmin(role: Role | undefined): boolean {
  return role !== undefined && ADMIN_ALLOWED_ROLES.has(role);
}

export function AdminGuard() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const isSessionLoading = useSessionStore(selectIsSessionLoading);
  const meQuery = useMeQuery();

  if (isSessionLoading || (isAuthenticated && meQuery.isLoading)) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return <ExternalLoginRedirect />;
  }

  if (!canAccessAdmin(meQuery.data?.role)) {
    return (
      <Navigate
        to="/404"
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
