import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from './auth.store';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
