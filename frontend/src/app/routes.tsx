import { BookOpenCheck, LayoutDashboard, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { logout } from '../api/auth';
import { checkHealth } from '../api/client';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { RegisterPage } from '../features/auth/RegisterPage';
import { useAuthStore } from '../features/auth/auth.store';
import { CourseDetailPage } from '../features/courses/CourseDetailPage';
import { CoursesPage } from '../features/courses/CoursesPage';
import { LearningPage } from '../features/learning/LearningPage';
import { NotificationsButton } from '../features/notifications/NotificationsButton';
import { LiveSessionPage } from '../features/sessions/LiveSessionPage';

function applyProjectTheme() {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = 'dark';
}

applyProjectTheme();

export function AppRoutes() {
  applyProjectTheme();

  return (
    <Routes>
      <Route index element={<RootRedirect />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route element={<ProductShell />}>
        <Route
          path="/courses"
          element={
            <ProtectedRoute>
              <CoursesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:courseId/learn"
          element={
            <ProtectedRoute>
              <LearningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:courseId"
          element={
            <ProtectedRoute>
              <CourseDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:courseId/sessions/:sessionId/live"
          element={
            <ProtectedRoute>
              <LiveSessionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sessions/:sessionId/live"
          element={
            <ProtectedRoute>
              <LiveSessionPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  );
}

function RootRedirect() {
  const user = useAuthStore((state) => state.user);

  return <Navigate to={user ? '/courses' : '/login'} replace />;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);

  if (user) {
    return <Navigate to="/courses" replace />;
  }

  return children;
}

export function ProductShell() {
  applyProjectTheme();

  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const logoutLocal = useAuthStore((state) => state.logoutLocal);
  const pageLabel = getPageLabel(location.pathname);
  const userInitials = getUserInitials(user?.name ?? user?.email ?? 'User');

  async function handleLogout() {
    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } finally {
      logoutLocal();
      navigate('/login', { replace: true });
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="brand-mark">LR</div>
          <div>
            <h1 className="sidebar-title">LMS Realtime</h1>
            <p className="sidebar-copy">Live learning workspace</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          <span className="sidebar-nav-label">Platform</span>
          <Link
            aria-current={location.pathname.startsWith('/courses') ? 'page' : undefined}
            className="sidebar-link"
            to="/courses"
          >
            <LayoutDashboard size={18} aria-hidden="true" />
            Courses
          </Link>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-user">
          <span className="user-avatar">{userInitials}</span>
          <div className="user-copy">
            <strong>{user?.name ?? 'User'}</strong>
            <span>{user?.role ? user.role.toLowerCase() : 'member'}</span>
          </div>
        </div>
      </aside>
      <section className="main-column">
        <header className="topbar">
          <div className="topbar-context">
            <BookOpenCheck size={18} aria-hidden="true" />
            <span>{pageLabel}</span>
          </div>
          <div className="topbar-actions">
            <BackendStatus />
            <NotificationsButton />
            <Button
              aria-label="Sign out"
              icon={<LogOut size={18} aria-hidden="true" />}
              iconOnly
              onClick={handleLogout}
              variant="ghost"
            />
          </div>
        </header>
        <Outlet />
      </section>
    </main>
  );
}

function getPageLabel(pathname: string) {
  if (pathname.includes('/sessions/')) {
    return 'Live room';
  }

  if (pathname.endsWith('/learn')) {
    return 'Learning workspace';
  }

  if (/^\/courses\/[^/]+/.test(pathname)) {
    return 'Course detail';
  }

  return 'Courses';
}

function getUserInitials(value: string) {
  const parts = value
    .replace(/@.*/, '')
    .split(/\s|\.|_/)
    .filter(Boolean);

  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'U';
}

function BackendStatus() {
  const health = useQuery({
    enabled: import.meta.env.MODE !== 'test',
    queryKey: ['health'],
    queryFn: checkHealth,
    retry: false,
  });

  if (import.meta.env.MODE === 'test') {
    return <StatusBadge>API ready</StatusBadge>;
  }

  if (health.isLoading) {
    return <StatusBadge>API checking</StatusBadge>;
  }

  if (health.isError) {
    return <StatusBadge tone="muted">API offline</StatusBadge>;
  }

  return <StatusBadge tone="success">{health.data?.status ?? 'API online'}</StatusBadge>;
}
