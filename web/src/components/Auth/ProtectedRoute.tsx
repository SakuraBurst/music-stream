import { Navigate, Outlet } from 'react-router';

import { useAuthStore } from '../../store/authStore.ts';

/**
 * Wrapper route that redirects unauthenticated users to /login.
 * Renders child routes via <Outlet /> when authenticated.
 */
export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
