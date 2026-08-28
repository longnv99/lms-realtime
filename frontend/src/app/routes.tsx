import { Bell, LayoutDashboard, Moon, Radio, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { checkHealth } from '../api/client';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { RegisterPage } from '../features/auth/RegisterPage';
import { CourseDetailPage } from '../features/courses/CourseDetailPage';
import { CoursesPage } from '../features/courses/CoursesPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ProductShell />}>
        <Route index element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/courses"
          element={
            <ProtectedRoute>
              <CoursesPage />
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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  );
}

function ProductShell() {
  const location = useLocation();

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div>
          <div className="brand-mark">LR</div>
          <h1 className="sidebar-title">LMS Realtime</h1>
          <p className="sidebar-copy">Live class, quiz, and course operations in one workspace.</p>
        </div>
        <nav className="sidebar-nav">
          <Link
            aria-current={location.pathname === '/courses' ? 'page' : undefined}
            className="sidebar-link"
            to="/courses"
          >
            <LayoutDashboard size={18} aria-hidden="true" />
            Courses
          </Link>
          <Link
            aria-current={location.pathname.includes('/sessions') ? 'page' : undefined}
            className="sidebar-link"
            to="/courses"
          >
            <Radio size={18} aria-hidden="true" />
            Live sessions
          </Link>
        </nav>
      </aside>
      <section className="main-column">
        <header className="topbar">
          <BackendStatus />
          <div className="topbar-actions">
            <Button aria-label="Search" icon={<Search size={18} />} iconOnly variant="ghost" />
            <Button aria-label="Notifications" icon={<Bell size={18} />} iconOnly variant="ghost" />
            <Button aria-label="Toggle theme" icon={<Moon size={18} />} iconOnly variant="ghost" />
          </div>
        </header>
        <Outlet />
      </section>
    </main>
  );
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
