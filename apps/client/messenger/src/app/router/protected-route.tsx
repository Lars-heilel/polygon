import { Navigate, Outlet, useLocation } from 'react-router';
import {
  useSessionStore,
  selectIsAuthenticated,
  selectIsSessionLoading,
} from '@org/entities';
import { Spinner } from '@org/shared';

export function ProtectedRoute() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const isLoading = useSessionStore(selectIsSessionLoading);
  const location = useLocation();

  if (isLoading) {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const isLoading = useSessionStore(selectIsSessionLoading);

  if (isLoading) {
    return <Spinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/chats" replace />;
  }

  return <Outlet />;
}
