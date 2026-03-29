import { Navigate, Outlet, useLocation } from 'react-router';
import { useSessionStore, selectIsAuthenticated } from '@org/entities';

export function ProtectedRoute() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/chats" replace />;
  }

  return <Outlet />;
}
