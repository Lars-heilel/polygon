import { Navigate, Outlet, useLocation } from 'react-router';

// Temporary stub — will read from auth store in Phase 2
function useIsAuthenticated(): boolean {
  return Boolean(localStorage.getItem('access_token'));
}

export function ProtectedRoute() {
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated) {
    return <Navigate to="/chats" replace />;
  }

  return <Outlet />;
}
